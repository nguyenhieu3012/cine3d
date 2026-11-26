---
name: gemini-studio
description: Gemini-native 3D video production workflow for cine3d (Trà đá với AI & GOAT Beef). Gemini 4 Neon High orchestrates pro, flash, flash_lite, and browser via Python run_workflow and direct multimodal video/audio review.
---

# Gemini Studio (`cine3d`) — v3.0

Độc lập hoàn toàn với `.claude/`. Tận dụng 5 lợi thế của Gemini + Antigravity:
1. **Phòng Biên Kịch & Thị Giác YouTube 2026 (`WRITERS-ROOM.md` + `stage="ideate"`):** Phân kỳ 3 góc tiếp cận khác bản chất (Grounded / Visual / Wildcard), xoay vòng 6 Comedy Engines, 4 Visual Jobs (`SHOW`/`COMPARE`/`SEQUENCE`/`LAND`), lọc sạch văn mùi AI, áp **Sàn Giải Trí ≥ 7/10** (Kill-Floors) tại `script_gate`.
2. **Hệ Sinh Thái Trình Bày 2D + Sticker Gemini (`core/overlay_board.js` + `packs/shared/stickers/`):** 5 layout sơ đồ khai báo sẵn (`flow`, `compare`, `chart`, `corkboard`, `tactics`), `statCard`, `sticker`, `highlighter`, và `setswapBackdrop` (Vox 12fps stutter + viền giấy cắt + dây đỏ + sân bóng Tifo) — **giảm ~90% code & token** so với vẽ Canvas 2D thủ công (`thaylamgiau_props.js`). Tạo thêm asset bằng `generate_image` + `tools/cutout_sticker.py`.
3. **Khởi tạo 0-token & Render nhanh (`scaffold_ep.py` + `build_check.py --draft` / `--chunks auto`):** Sinh sẵn khung `episodes/<id>.js` chuẩn QA ở 0 token trước khi `flash` gọt diễn xuất; xem nháp layout `--draft` (12fps, <2 phút) trước khi render Final 30fps CRF17 tự chia chunk chống tràn RAM Chromium.
4. **Xem video & nghe tiếng thật (`read_file`):** `out/<id>/review_proxy.mp4` (540p, 24fps, AAC 96k, ~2–4 MB) + `out/<id>/audio/mix_preview.mp3` (~550 KB) — bỏ hoàn toàn `cs*.jpg` và strip 8fps.
5. **Điều phối Python (`run_workflow`, 0 token) & 1 nguồn sự thật gọn:** Main chỉ nạp `SKILL.md` + `WRITERS-ROOM.md` + 1 file `specs/<channel>.md`; cấm nạp `ENGINE.md` (164 KB). GOAT Beef đồng bộ trọn vẹn `look2: true, act2: true, facePlus: true` (`packs/goat/faceplus.js`).

## Phân tầng Model
- **Showrunner (`Gemini 4 Neon High`, Main):** chọn hướng từ `stage="ideate"`, tạo sticker/backdrop mới bằng `generate_image` khi cần, duyệt/punch-up card/treatment/beats, nghe `mix_preview.mp3`, xem+nghe `review_proxy.mp4` lần cuối, giao tiếp chủ kênh.
- **Writers' Room & Blind Gates (`pro`):** `stage="ideate"` (3-take pitch & kill rationale); Cổng kịch bản đọc mù (thấy cả `"visual"`/`"note"`/`"card"`, ẩn `meta`/logline; 8 điểm + 5–6 Sàn Giải Trí ≥ 7/10; GOAT chạy song song Cold-Reader + Fact-Checker live ≥ 2 nguồn); Cổng phim mù **2 bước thật sự** trên `review_proxy.mp4` (Bước 1 xem mù không có beats → Bước 2 đối chiếu beats + kiểm tra waiver) → **1 fix-list duy nhất**.
- **3D Builder (`flash` → tự động leo thang `pro` nếu vòng 3/BLOCKED):** nhận bản khung 0-token từ `tools/scaffold_ep.py`, tinh chỉnh diễn xuất, `boardOverlay`/`goatStatCard`/`setswapBackdrop`, sửa gộp tối đa **3 vòng** theo `build_check.py` (≤ 25 dòng/lần). Chỉ đọc `ENGINE-CORE.md` + `specs/<channel>.md`.
- **Hậu cần (`flash_lite`):** đóng gói `goi-dang.md` (Python xác minh tồn tại file & luật tiêu đề), state/ledger, `yt.py` API (khi có lệnh).
- **Đăng bài (`browser`, cách ly):** chỉ gọi khi có lệnh đăng batch (3–5 tập/lần) trên TikTok/FB.

## Quy trình 7 Giai đoạn (dựng 3D đúng 1 lần trên giờ thật)
0. **Phòng Biên Kịch (`stage="ideate"`):** Đưa chủ đề/slot → `pro` sinh **3 hướng khác bản chất** (Grounded / Visual / Wildcard), chọn 1 hướng + lý do loại 2 hướng kia + bản nháp `card.json` có Comedy Engine & Visual Gag.
1. **Kịch bản → Cổng kịch bản (`stage="script_gate"`):** `pipeline.py new <id> --channel trada|goat --workflow gemini` → viết card/treatment/beats (kèm `"visual"`, `gap` động, ElevenLabs `"say"` tag, `"mode"`) → chạy `episode_pipeline.py` stage `script_gate` (`scriptlint` 0 token → `pro` đọc mù JSON + Sàn Giải Trí ≥ 7/10 → `voice.py need` báo giá) → **DỪNG**.
2. **Khóa tiền ElevenLabs → Thu giọng → Trộn & Nghe (`stage="audio"`):** báo giá chủ kênh → chỉ sau khi duyệt mới ghi `pipeline.py record <id> credit_owner OK --by driver --quote "<lời chủ>"` (khóa **fail-closed**, bắt buộc `script_gate` PASS còn tươi) → thu giọng → chạy `stage="audio"` (`build_check.py --audio`: mix + `audiogate` + `scriptlint` giờ thật + phát hiện `SYNTH_FALLBACK` + `mix_preview.mp3`) → **Main nghe `mix_preview.mp3` bằng `read_file`**.
3. **Khởi tạo 0-token + Dựng 3D trên giờ thật (`stage="build_and_gate"`, bước 1):** `scaffold_ep.py` dựng khung chuẩn QA (0 token) → `flash` gọt diễn xuất & sơ đồ khai báo (`overlay_board.js`), Python chạy `build_check.py` (auto-lips + `qa` + `clipcheck`), sửa gộp ≤ 3 vòng (tự động nâng cấp `pro` ở vòng cuối hoặc khi `BLOCKED`). Khi cần duyệt nhanh bố cục sơ đồ trước Final, chạy `build_check.py --draft` (< 2 phút).
4. **Render Final 30fps (Auto-Chunk) + Proxy + Cổng phim mù 2 bước (`stage="build_and_gate"`, bước 2–4):** checkpoint trước render → `build_check.py --final` (`--chunks auto`, 1080×1920, 30fps CFR, CRF 17, AAC 192k 48kHz, `smooth.py`, `review_proxy.mp4`) → `pro` **Bước 1 xem+nghe mù** `review_proxy.mp4` → **Bước 2 đối chiếu `beats` & waiver** → nếu FAIL, sửa gộp 1 lượt + render lại + kiểm lại.
5. **Duyệt cuối Main → Chủ kênh:** Main dùng `read_file` xem+nghe `review_proxy.mp4` (6 cửa), ghi `driver_review OK`, giao Final MP4 + cover cho chủ kênh duyệt (`owner OK --quote`).
6. **Đóng gói (`stage="package"`) & Đăng batch (`browser`):** chỉ chạy sau `pipeline.py can-post <id>` PASS, Python kiểm tra `goi-dang.md` tồn tại và sạch luật tiêu đề trước khi trả PASS.

## Khóa An Toàn
- **Cấm gọi `voice.py record --yes`** trước khi chủ kênh duyệt `credit_owner OK --quote` (code chặn **fail-closed** exit 3).
- **Cấm tự đăng/xóa bài** khi chưa có lệnh. **Cấm sửa `.claude/`** hay phá `tools/regress.py`.
- **Chỉ mục:** `WRITERS-ROOM.md` · `specs/trada.md` · `specs/goat.md` · `ENGINE-CORE.md` · `ENGINE-INDEX.md` · `.agents/workflows/episode_pipeline.py` · `tools/scaffold_ep.py` · `tools/cutout_sticker.py` · `tools/build_check.py`.


