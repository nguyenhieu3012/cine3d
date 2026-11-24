# Thư viện âm thanh thật `cine3d` (`audio_lib/`)

Thư viện SFX, nhạc nền và ambience chuẩn **48 kHz** thu thập từ các nguồn **CC0 / Public Domain** thật, tự động gắn với `tools/voice.py` và `tools/audiogate.py`.

## Cách dùng trong `.beats.json`

1. **Bật bộ SFX + nền thật:**
   - Mặc định mọi tập `rules: 2` (Blueprint v2.0) tự dùng `audio_lib/` (`sfxMode: "real"`).
   - Tập `rules: 1` có thể bật bằng `"sfxMode": "real"`, hoặc dùng trực tiếp tên hiệu ứng mới (`stamp`, `msg_in`, `thought_pop`, `paper_slip`, `voice_note`, `dial_busy`, `tea_pour`...).
   - Muốn giữ bản synth cũ cho 1 hiệu ứng bất kỳ: thêm `"synth": true` trong mục `sfx` đó.

2. **Dùng nhạc nền thật (1 bài hoặc ghép nhiều đoạn tự crossfade):**
   - Một bài xuyên suốt (tự lặp mượt nếu phim dài hơn bài nhạc):
     ```json
     "music": { "track": "comedy_quirky", "fade": 1.2, "lufs": -26 }
     ```
   - Đổi nhạc đúng nhịp kịch bản (ví dụ đầu căng thẳng → từ câu `l11` chuyển sang ấm áp):
     ```json
     "music": {
       "fade": 1.0,
       "tracks": [
         { "track": "tension_comic", "from": 0, "to": "l11", "xfade": 0.6 },
         { "track": "warm_family", "from": "l11", "to": "end", "xfade": 0.9 }
       ]
     }
     ```

## Kiểm tra thư viện
- Liệt kê toàn bộ SFX / nhạc / ambience: `python3 tools/sfx_lib.py list`
- Kiểm tra tệp, chuẩn 48kHz, chống clip/DC, giấy phép: `python3 tools/sfx_lib.py verify`
