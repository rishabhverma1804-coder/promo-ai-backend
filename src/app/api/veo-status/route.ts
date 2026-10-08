import { NextResponse } from "next/server";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    const operationName =
      "models/veo-3.1-generate-preview/operations/0ur21xqsmrfg";

    console.log("Checking existing Veo operation:");
    console.log(operationName);

    const response = await fetch(
      `${GEMINI_BASE_URL}/${operationName}`,
      {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
      }
    );

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        rawResponse: text,
      };
    }

    console.log(
      "Veo status response:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    return NextResponse.json(
      {
        success: response.ok,
        httpStatus: response.status,
        operation: data,
      },
      {
        status: response.ok ? 200 : response.status,
      }
    );

  } catch (error) {
    console.error(
      "Veo status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check Veo operation.",
      },
      {
        status: 500,
      }
    );
  }
}