// ============================================================================
// SPEECH-TO-TEXT API ENDPOINT (Whisper)
// ============================================================================
// Endpoint do transkrypcji audio przy użyciu OpenAI Whisper

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (Whisper max: 25MB)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }

    console.log('Transcribing audio:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pl', // Polish - przyspiesza processing
      response_format: 'json',
      temperature: 0.0, // Maksymalna dokładność
    });

    console.log('Transcription result:', transcription.text);

    // Return transcription
    return NextResponse.json({
      text: transcription.text,
      language: 'pl',
    });

  } catch (error: any) {
    console.error('Whisper API error:', error);

    // Handle specific errors
    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout. Please try with shorter audio.' },
        { status: 504 }
      );
    }

    // Generic error
    return NextResponse.json(
      { 
        error: 'Transcription failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Configure route
export const runtime = 'nodejs';
export const maxDuration = 30; // Max 30 seconds for Whisper processing

