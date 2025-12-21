# OpenAI Realtime API - Przewodnik

## 🎯 Dlaczego Realtime API?

Poprzedni system używał **3 osobnych wywołań API**:
1. **Whisper** (Speech-to-Text) - transkrypcja mowy
2. **GPT-5.2** (LLM) - generowanie odpowiedzi tekstowej
3. **ElevenLabs** (Text-to-Speech) - synteza mowy

To powodowało **długie opóźnienia** (3-5+ sekund).

### OpenAI Realtime API oferuje:
- ✅ **Bezpośrednią komunikację audio-to-audio** (bez pośrednich kroków)
- ✅ **Znacznie szybsze odpowiedzi** (streaming w czasie rzeczywistym)
- ✅ **Niższe koszty** (jedno API zamiast trzech)
- ✅ **Lepszą synchronizację** (brak artefaktów między STT→LLM→TTS)

---

## 📋 Wymagania

### 1. API Key
Upewnij się, że masz klucz API OpenAI w pliku `.env`:

```bash
OPENAI_API_KEY=sk-...
```

### 2. Model
Realtime API używa modelu: `gpt-4o-realtime-preview-2024-12-17`

Ten model obsługuje:
- Audio input (PCM16, 24kHz)
- Audio output (PCM16, 24kHz)
- Transkrypcję (Whisper-1)
- Voice Activity Detection (VAD)
- Polski język ✅

---

## 🚀 Jak używać

### ⚠️ Ważne: Custom Server

Realtime API wymaga **custom servera** z WebSocket relay (przeglądarka nie może bezpośrednio łączyć się z OpenAI API z custom headers).

**Uruchom aplikację używając:**
```bash
npm run dev  # Uruchamia custom server z WebSocket relay
```

**NIE używaj** `npm run dev:next` - to uruchamia standardowy Next.js bez WebSocket.

### Przełączanie trybu

W aplikacji zobaczysz przełącznik trybu głosowego:

```
[ ElevenLabs 🎵 ] [ Realtime API ⚡ ]
```

- **ElevenLabs** - wysoka jakość głosu (wolniejsze, 3+ sekundy)
- **Realtime API** - szybkie odpowiedzi (szybsze, <1 sekundy)

Możesz przełączać tryb w dowolnym momencie (gdy aplikacja jest w stanie "czekania").

### Workflow Realtime API

1. **Auto-connect**: Aplikacja automatycznie łączy się z OpenAI Realtime API przy starcie
2. **Naciśnij mikrofon**: Rozpocznij mówienie (zielony przycisk ⚡)
3. **Mów**: System automatycznie wykryje początek i koniec mowy (VAD)
4. **Odpowiedź**: Otrzymasz audio odpowiedź w czasie rzeczywistym (streaming)
5. **Przerwij**: Możesz przerwać odpowiedź w dowolnym momencie (pomarańczowy przycisk)

---

## 🔧 Konfiguracja

### Ustawienia postaci

W pliku `lib/characters.ts` możesz dostosować zachowanie:

```typescript
llmConfig: {
  temperature: 0.8,        // Kreatywność (0.7-1.0)
  maxTokens: 150,          // Max długość odpowiedzi
  model: 'gpt-5.2',        // Model LLM (dla ElevenLabs mode)
}
```

Realtime API używa tych samych ustawień (temperature, maxTokens).

### Voice Selection

Realtime API oferuje 6 głosów:
- `alloy` (domyślny, neutralny)
- `echo` (męski, spokojny)
- `fable` (ekspresywny)
- `onyx` (męski, głęboki)
- `nova` (żeński, energiczny)
- `shimmer` (żeński, ciepły)

Możesz zmienić głos w `app/api/realtime-voice/route.ts`:

```typescript
voice: 'alloy', // Zmień na inny głos
```

---

## 📊 Porównanie

| Funkcja | ElevenLabs Mode | Realtime API Mode |
|---------|----------------|-------------------|
| Czas odpowiedzi | 3-5+ sekund | <1 sekunda |
| Jakość głosu | Bardzo wysoka | Wysoka |
| Koszty | Wyższe (3 API) | Niższe (1 API) |
| Personalizacja głosu | Pełna (ElevenLabs) | Ograniczona (6 głosów) |
| Streaming | Nie | Tak ✅ |
| VAD (wykrywanie mowy) | Klient | Serwer ✅ |
| Przerwanie | Ograniczone | Natychmiastowe ✅ |

---

## 🐛 Troubleshooting

### "Nie połączono z Realtime API"
- Sprawdź czy masz poprawny `OPENAI_API_KEY` w `.env`
- Sprawdź konsolę przeglądarki (F12) dla błędów WebSocket
- Spróbuj odświeżyć stronę

### "WebSocket connection error"
- Sprawdź połączenie internetowe
- Upewnij się, że firewall nie blokuje WebSocket (wss://)
- Niektóre sieci korporacyjne mogą blokować WebSocket

### "Audio playback error"
- Upewnij się, że przeglądarka obsługuje Web Audio API
- Sprawdź czy masz dostęp do mikrofonu (Settings → Privacy)
- Spróbuj innej przeglądarki (Chrome/Edge rekomendowane)

### Odpowiedzi są nadal wolne
- Realtime API działa najlepiej przy dobrej jakości internetu
- Jeśli masz wolne łącze, pozostań przy ElevenLabs mode
- Sprawdź ping do `api.openai.com` (powinien być <100ms)

---

## 💡 Wskazówki

1. **Używaj Realtime API dla interaktywnych występów** - szybkie odpowiedzi tworzą lepsze doświadczenie
2. **Używaj ElevenLabs dla nagrań/demo** - jeśli priorytetem jest jakość głosu
3. **Testuj oba tryby** - zobacz który lepiej pasuje do Twoich potrzeb
4. **Mów jasno** - VAD działa najlepiej przy czystym audio bez szumów tła

---

## 📚 Zasoby

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime API Reference](https://platform.openai.com/docs/api-reference/realtime)
- [ElevenLabs vs OpenAI Comparison](https://elevenlabs.io/blog/comparing-elevenlabs-conversational-ai-v-openai-realtime-api)

---

## 🔄 Następne kroki

### Możliwe ulepszenia:

1. **Multi-turn conversations** - obecnie każda interakcja jest niezależna
2. **Function calling** - Realtime API obsługuje wywoływanie funkcji
3. **Emotion detection** - analiza emocji w czasie rzeczywistym
4. **Custom voice fine-tuning** - przyszła funkcja OpenAI
5. **Buffering optimization** - lepsze zarządzanie kolejką audio

---

Powodzenia! 🎭

