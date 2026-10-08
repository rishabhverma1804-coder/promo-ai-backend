import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const VIDEO_URI =
  "https://generativelanguage.googleapis.com/v1beta/files/txsot8c91ocf:download?alt=media";

export async function GET() {
  try {
    console.log("=================================");
    console.log("Veo Video Download Test");
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
        }
      );
    }

    console.log("Downloading generated Veo video...");

    const response = await fetch(VIDEO_URI, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    console.log("Download HTTP status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Video download failed:");
      console.error(errorText);

      return NextResponse.json(
        {
          success: false,
          httpStatus: response.status,
          error: errorText,
        },
        {
          status: 500,
        }
      );
    }

    console.log("Video response received.");

    const videoBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    console.log(
      "Video size:",
      videoBuffer.length,
      "bytes"
    );

    if (videoBuffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Downloaded video is empty.",
        },
        {
          status: 500,
        }
      );
    }

    const generatedDirectory = path.join(
      process.cwd(),
      "public",
      "generated"
    );

    await fs.mkdir(generatedDirectory, {
      recursive: true,
    });

    const fileName = `veo-test-${Date.now()}.mp4`;

    const filePath = path.join(
      generatedDirectory,
      fileName
    );

    await fs.writeFile(
      filePath,
      videoBuffer
    );

    console.log("Video saved:");
    console.log(filePath);

    const publicVideoUrl =
      `http://localhost:3000/generated/${fileName}`;

    console.log("Public video URL:");
    console.log(publicVideoUrl);

    return NextResponse.json({
      success: true,
      message:
        "Veo video downloaded and saved successfully.",
      fileName,
      filePath,
      videoSize: videoBuffer.length,
      videoUrl: publicVideoUrl,
    });

  } catch (error) {
    console.error("Veo download test error:");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download Veo video.",
      },
      {
        status: 500,
      }
    );
  }
}
