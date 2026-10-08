import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type GenerateReelRequest = {
  productName?: string;
  description?: string;
  price?: string;
  offer?: string;
  targetAudience?: string;
  category?: string;
  reelStyle?: string;
  duration?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const VEO_MODEL =
  "veo-3.1-generate-preview";

const GENERATION_POLL_INTERVAL = 10000;
const MAX_GENERATION_ATTEMPTS = 60;

const DOWNLOAD_TIMEOUT = 30000;
const MAX_DOWNLOAD_ATTEMPTS = 3;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    console.log("=================================");
    console.log("Promo AI - Veo Reel Generation");
    console.log("=================================");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is not configured.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const body: GenerateReelRequest =
      await request.json();

    const {
      productName,
      description,
      price,
      offer,
      targetAudience,
      category,
      reelStyle = "cinematic",
    } = body;

    /*
     * Product name is the only required field.
     */

    if (!productName?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Product name is required.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    /*
     * Build product information.
     *
     * Only information supplied by the user
     * is passed to the creative prompt.
     */

    const productDetails = [
      `Product name: ${productName.trim()}`,

      description?.trim()
        ? `Product description: ${description.trim()}`
        : "",

      price?.trim()
        ? `Price: ${price.trim()}`
        : "",

      offer?.trim()
        ? `Offer: ${offer.trim()}`
        : "",

      targetAudience?.trim()
        ? `Target audience: ${targetAudience.trim()}`
        : "",

      category?.trim()
        ? `Category: ${category.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    /*
     * Veo prompt.
     *
     * Product information can be partial.
     * AI can fill creative gaps visually,
     * but must not invent factual claims.
     */

    const prompt = `
Create a professional 8-second vertical promotional
video advertisement for the following product.

PRODUCT INFORMATION
${productDetails}

CREATIVE STYLE
${reelStyle}

VIDEO REQUIREMENTS

Create a premium social-media advertisement suitable
for Instagram Reels.

The product should remain the main visual focus.

Use:

- cinematic commercial photography
- professional product lighting
- realistic materials and textures
- attractive composition
- smooth camera movement
- visually engaging opening
- elegant transitions
- premium advertising aesthetics
- vertical 9:16 composition
- strong visual storytelling
- polished commercial quality

The video should feel like a professionally produced
brand advertisement rather than a generic AI video.

IMPORTANT FACTUAL ACCURACY RULES

Only use factual information explicitly provided in
PRODUCT INFORMATION.

Do NOT invent or display:

- prices
- discounts
- offers
- specifications
- ingredients
- certifications
- guarantees
- technical features
- performance claims
- medical claims
- brand claims
- measurements
- ratings
- awards
- availability claims

If some information is missing, do not invent it.

Instead, communicate the product through:

- visual atmosphere
- product beauty shots
- camera movement
- lighting
- environment
- texture
- emotion
- lifestyle-oriented visual storytelling

Do not add readable text overlays containing
unprovided factual information.

If the product information is minimal, create the
creative concept using visual storytelling rather
than inventing product facts.

The final result must be a vertical 9:16
professional product advertisement.
`;

    console.log("Product:", productName.trim());
    console.log("Style:", reelStyle);
    console.log("Veo model:", VEO_MODEL);

    /*
     * STEP 1
     *
     * Start Veo long-running generation.
     */

    console.log("Starting Veo generation...");

    const generateResponse = await fetch(
      `${GEMINI_BASE_URL}/models/${VEO_MODEL}:predictLongRunning`,
      {
        method: "POST",

        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          instances: [
            {
              prompt,
            },
          ],

          parameters: {
            aspectRatio: "9:16",
            resolution: "720p",
          },
        }),
      }
    );

    const generateText =
      await generateResponse.text();

    let generateData: any;

    try {
      generateData =
        JSON.parse(generateText);
    } catch {
      generateData = {
        error: generateText,
      };
    }

    if (!generateResponse.ok) {
      console.error(
        "Veo generation request failed:"
      );

      console.error(
        JSON.stringify(
          generateData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            typeof generateData?.error === "object"
              ? JSON.stringify(
                  generateData.error
                )
              : String(
                  generateData?.error ||
                  generateText
                ),
        },
        {
          status: generateResponse.status,
          headers: corsHeaders,
        }
      );
    }

    /*
     * Google returns an asynchronous operation.
     */

    const operationName =
      generateData?.name;

    if (!operationName) {
      console.error(
        "Veo did not return an operation name:"
      );

      console.error(
        JSON.stringify(
          generateData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Veo did not return a generation operation.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      "Veo operation started:"
    );

    console.log(
      operationName
    );

    /*
     * STEP 2
     *
     * Poll the operation until it finishes.
     */

    let operationData: any = null;

    for (
      let attempt = 1;
      attempt <= MAX_GENERATION_ATTEMPTS;
      attempt++
    ) {
      console.log(
        `Checking Veo operation... attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}`
      );

      await new Promise((resolve) =>
        setTimeout(
          resolve,
          GENERATION_POLL_INTERVAL
        )
      );

      const operationResponse =
        await fetch(
          `${GEMINI_BASE_URL}/${operationName}`,
          {
            method: "GET",

            headers: {
              "x-goog-api-key": apiKey,
            },
          }
        );

      const operationText =
        await operationResponse.text();

      try {
        operationData =
          JSON.parse(operationText);
      } catch {
        operationData = {
          error: operationText,
        };
      }

      if (!operationResponse.ok) {
        console.error(
          "Veo operation request failed:"
        );

        console.error(
          JSON.stringify(
            operationData,
            null,
            2
          )
        );

        return NextResponse.json(
          {
            success: false,
            error:
              typeof operationData?.error ===
              "object"
                ? JSON.stringify(
                    operationData.error
                  )
                : String(
                    operationData?.error ||
                    operationText
                  ),
          },
          {
            status:
              operationResponse.status,
            headers: corsHeaders,
          }
        );
      }

      console.log(
        "Operation done:",
        operationData?.done
      );

      /*
       * Google operation response is normally:
       *
       * {
       *   name: "...",
       *   done: false
       * }
       *
       * or when completed:
       *
       * {
       *   name: "...",
       *   done: true,
       *   response: {...}
       * }
       */

      if (operationData?.done === true) {
        console.log(
          "Veo generation completed."
        );

        break;
      }

      if (
        attempt ===
        MAX_GENERATION_ATTEMPTS
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Veo generation timed out while waiting for the video.",
          },
          {
            status: 504,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
     * STEP 3
     *
     * Check if Veo completed with an error.
     */

    if (operationData?.error) {
      console.error(
        "Veo completed with an error:"
      );

      console.error(
        JSON.stringify(
          operationData.error,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            typeof operationData.error ===
            "object"
              ? JSON.stringify(
                  operationData.error
                )
              : String(
                  operationData.error
                ),
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    /*
     * Make sure the operation really completed.
     */

    if (operationData?.done !== true) {
      console.error(
        "Veo operation did not complete."
      );

      console.error(
        JSON.stringify(
          operationData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Veo operation did not complete successfully.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    /*
     * STEP 4
     *
     * Get generated video URI.
     */

    const videoUri =
      operationData
        ?.response
        ?.generateVideoResponse
        ?.generatedSamples?.[0]
        ?.video?.uri;

    if (!videoUri) {
      console.error(
        "Veo completed but returned no video URI."
      );

      console.error(
        JSON.stringify(
          operationData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Veo completed but no video was returned.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      "Veo video URI received."
    );

    /*
     * STEP 5
     *
     * Download the generated MP4.
     *
     * We use an AbortController so that a network
     * problem does not hang the whole request forever.
     *
     * We also retry the download up to 3 times.
     */

    let videoBuffer: Buffer | null = null;

    for (
      let attempt = 1;
      attempt <= MAX_DOWNLOAD_ATTEMPTS;
      attempt++
    ) {
      console.log(
        `Downloading Veo video... attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}`
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          DOWNLOAD_TIMEOUT
        );

      try {
        const videoResponse =
          await fetch(
            videoUri,
            {
              method: "GET",

              headers: {
                "x-goog-api-key": apiKey,
              },

              signal:
                controller.signal,
            }
          );

        clearTimeout(timeout);

        console.log(
          "Video download HTTP status:",
          videoResponse.status
        );

        if (!videoResponse.ok) {
          const errorText =
            await videoResponse.text();

          console.error(
            "Video download failed:"
          );

          console.error(
            errorText
          );

          if (
            attempt ===
            MAX_DOWNLOAD_ATTEMPTS
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Generated video could not be downloaded.",
              },
              {
                status: 500,
                headers: corsHeaders,
              }
            );
          }

          continue;
        }

        videoBuffer =
          Buffer.from(
            await videoResponse.arrayBuffer()
          );

        console.log(
          "Video downloaded successfully."
        );

        console.log(
          "Video size:",
          videoBuffer.length,
          "bytes"
        );

        break;

      } catch (downloadError) {
        clearTimeout(timeout);

        console.error(
          `Video download attempt ${attempt} failed:`
        );

        console.error(
          downloadError
        );

        if (
          attempt ===
          MAX_DOWNLOAD_ATTEMPTS
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Generated video could not be downloaded after multiple attempts.",
            },
            {
              status: 500,
              headers: corsHeaders,
            }
          );
        }

        console.log(
          "Retrying video download..."
        );
      }
    }

    /*
     * Make sure we actually received video data.
     */

    if (
      !videoBuffer ||
      videoBuffer.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Downloaded video is empty.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    /*
     * STEP 6
     *
     * Save MP4 inside Next.js public folder.
     */

    const generatedDirectory =
      path.join(
        process.cwd(),
        "public",
        "generated"
      );

    await fs.mkdir(
      generatedDirectory,
      {
        recursive: true,
      }
    );

    const fileName =
      `reel-${Date.now()}.mp4`;

    const filePath =
      path.join(
        generatedDirectory,
        fileName
      );

    await fs.writeFile(
      filePath,
      videoBuffer
    );

    console.log(
      "Video saved:"
    );

    console.log(
      filePath
    );

    /*
     * STEP 7
     *
     * Return the response structure expected
     * by the Ionic application.
     */

    const publicVideoUrl =
      `http://localhost:3000/generated/${fileName}`;

    const reel = {
      title:
        `${productName.trim()} Promotional Reel`,

      productName:
        productName.trim(),

      description:
        description?.trim() || null,

      price:
        price?.trim() || null,

      offer:
        offer?.trim() || null,

      targetAudience:
        targetAudience?.trim() || null,

      category:
        category?.trim() || null,

      reelStyle:
        reelStyle.trim(),

      duration: 8,

      format:
        "9:16",

      resolution:
        "720p",

      status:
        "completed",

      videoUrl:
        publicVideoUrl,

      message:
        "AI promotional Reel generated successfully.",
    };

    console.log(
      "Promo AI Reel generation completed."
    );

    return NextResponse.json(
      {
        success: true,

        mode:
          "veo-3.1",

        reel,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );

  } catch (error) {
    console.error(
      "Generate Reel Error:"
    );

    console.error(
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to generate AI video.",
      },
      {
        status: 500,

        headers: corsHeaders,
      }
    );
  }
}
