// ============================================================================
// TEXT-TO-SPEECH API ENDPOINT (ElevenLabs)
// ============================================================================
// Endpoint do syntezy mowy przy użyciu ElevenLabs

import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

interface TTSRequest {
  text: string;
  voiceId: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Parse request
    const body: TTSRequest = await request.json();
    const { text, voiceId, voiceSettings } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      );
    }

    // Limit text length (ElevenLabs limits)
    const MAX_TEXT_LENGTH = 5000;
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` },
        { status: 400 }
      );
    }

    console.log('TTS request:', {
      textLength: text.length,
      voiceId,
      text: text.substring(0, 100) + '...',
    });

    // Default voice settings (optimized for natural conversation)
    const settings = {
      stability: voiceSettings?.stability ?? 0.5,
      similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
      style: voiceSettings?.style ?? 0.0,
      use_speaker_boost: voiceSettings?.use_speaker_boost ?? true,
    };

    // Call ElevenLabs API with streaming
    // MP3 works on all browsers including Safari
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_multilingual_v2', // Supports Polish
      voice_settings: settings,
      optimize_streaming_latency: 3, // 0-4, 3 is good balance
      output_format: 'mp3_44100_128', // MP3 works universally
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log('TTS completed:', {
      audioSize: audioBuffer.length,
      format: 'mp3_44100_128',
    });

    // Return audio as response
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('ElevenLabs TTS error:', error);

    // Handle specific errors
    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid ElevenLabs API key' },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error?.status === 400) {
      return NextResponse.json(
        { 
          error: 'Invalid request',
          details: error?.message || 'Check voice ID or text format',
        },
        { status: 400 }
      );
    }

    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout. Please try with shorter text.' },
        { status: 504 }
      );
    }

    // Generic error
    return NextResponse.json(
      { 
        error: 'TTS generation failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Configure route
export const runtime = 'nodejs';
export const maxDuration = 60; // Max 60 seconds for TTS (can be long for streaming)

