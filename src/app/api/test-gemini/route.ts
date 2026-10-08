import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY is missing.",
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",

        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Reply with exactly: Gemini API is working.",
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          googleError: data,
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gemini API key is working.",
      response: data,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gemini test failed.",
    });
  }
}