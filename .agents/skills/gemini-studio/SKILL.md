---
name: gemini-studio
description: Gemini-native 3D video production workflow for cine3d (Trà đá với AI & GOAT Beef). Gemini 4 Neon High orchestrates pro, flash, flash_lite, and browser via Python run_workflow and direct multimodal video/audio review.
---

# Gemini Studio (`cine3d`)

Độc lập hoàn toàn với `.claude/`. Tận dụng 3 lợi thế của Gemini + Antigravity:
1. **Xem video & nghe tiếng thật (`read_file`):** `out/<id>/review_proxy.mp4` (540p, 24fps, AAC 96k, ~2–4 MB) + `out/<id>/audio/mix_preview.mp3` (~550 KB) — bỏ hoàn toàn `cs*.jpg` và strip 8fps.
2. **Điều phối Python (`run_workflow`, 0 token):** mọi bước deterministic chạy bằng code; mọi sub-agent ép **JSON Schema cứng** (`.agents/workflows/schemas.py`).
3. **1 nguồn sự thật gọn (Progressive Disclosure):** Main chỉ nạp `SKILL.md` + 1 file `specs/<channel>.md`; cấm nạp `ENGINE.md` (164 KB).

## Phân tầng Model
- **Showrunner (`Gemini 4 Neon High`, Main):** chốt ý/card/treatment/beats, nghe `mix_preview.mp3`, xem+nghe `review_proxy.mp4` lần cuối, giao tiếp chủ kênh.
- **Blind Gates (`pro`):** Cổng kịch bản đọc mù (Trà đá 8 điểm; GOAT Cold-Reader + Fact-Checker song song) & Cổng phim mù 6 cửa trên `review_proxy.mp4` → **1 fix-list duy nhất**.
- **3D Builder (`flash`):** viết `episodes/<id>.js` (+ `ep_kit.js`), sửa gộp tối đa **3 vòng** theo `build_check.py` (≤ 25 dòng/lần). Chỉ đọc `ENGINE-CORE.md` + `specs/<channel>.md`.
- **Hậu cần (`flash_lite`):** đóng gói `goi-dang.md`, state/ledger, `yt.py` API (khi có lệnh).
- **Đăng bài (`browser`, cách ly):** chỉ gọi khi có lệnh đăng batch (3–5 tập/lần) trên TikTok/FB.

## Quy trình 6 Giai đoạn (dựng 3D đúng 1 lần trên giờ thật)
1. **Ý tưởng → Kịch bản → Cổng kịch bản (`stage="script_gate"`):** `pipeline.py new <id> --channel trada|goat --workflow gemini` → viết card/treatment/beats → chạy `episode_pipeline.py` stage `script_gate` (`scriptlint` 0 token → `pro` đọc mù JSON → `voice.py need` báo giá) → **DỪNG**.
2. **Khóa tiền ElevenLabs → Thu giọng → Trộn & Nghe (`stage="audio"`):** báo giá chủ kênh → chỉ sau khi duyệt mới ghi `pipeline.py record <id> credit_owner OK --by driver --quote "<lời chủ>"` → thu giọng → chạy `stage="audio"` (`build_check.py --audio`: mix + `audiogate` + `scriptlint` giờ thật + cảnh báo `SYNTH_FALLBACK` + `mix_preview.mp3`) → **Main nghe `mix_preview.mp3` bằng `read_file`**.
3. **Dựng 3D trên giờ thật (`stage="build_and_gate"`, bước 1):** `flash` viết `episodes/<id>.js`, Python chạy `build_check.py` (auto-lips + `qa` + `clipcheck`), sửa gộp ≤ 3 vòng.
4. **Render Final 30fps + Proxy + Cổng phim mù (`stage="build_and_gate"`, bước 2–4):** `build_check.py --final` (1080×1920, 30fps CFR, CRF 17, AAC 192k 48kHz, 0 timecode, `smooth.py`, `review_proxy.mp4`) → `pro` xem+nghe mù `review_proxy.mp4` → nếu FAIL, sửa gộp 1 lượt trên đúng `flash` cũ + render lại + kiểm lại điểm sửa.
5. **Duyệt cuối Main → Chủ kênh:** Main dùng `read_file` xem+nghe `review_proxy.mp4` (6 cửa), ghi `driver_review OK`, giao Final MP4 + cover cho chủ kênh duyệt (`owner OK --quote`).
6. **Đóng gói (`stage="package"`) & Đăng batch (`browser`):** chỉ chạy sau `pipeline.py can-post <id>` PASS và có lệnh đăng rõ ràng.

## Khóa An Toàn
- **Cấm gọi `voice.py record --yes`** trước khi chủ kênh duyệt `credit_owner OK --quote` (code chặn exit 3).
- **Cấm tự đăng/xóa bài** khi chưa có lệnh. **Cấm sửa `.claude/`** hay phá `tools/regress.py`.
- **Chỉ mục:** `specs/trada.md` · `specs/goat.md` · `ENGINE-CORE.md` · `ENGINE-INDEX.md` · `.agents/workflows/episode_pipeline.py` · `tools/build_check.py`.
