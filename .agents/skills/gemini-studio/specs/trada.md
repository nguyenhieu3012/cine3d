# Spec: Trà đá với AI (`trada`) — Blueprint v2.1 (1 Nguồn Sự Thật)

> Mặc định tập mới: `rules: 2, fps: 30, look2: true, act2: true, facePlus: true, setOpts: { plus: true, menuBrand: true }` (+ `mailbox: true` khi dùng Hòm Thư). Khán giả VN 25–34t. **Chỉ làm Anthology** (không mở series mới; Zombie đóng; "Quỹ về Tết" đã hủy).
> **BẮT BUỘC nạp kèm khi nghĩ ý / viết kịch bản / chấm cổng:** `.agents/skills/gemini-studio/WRITERS-ROOM.md` (3-Take Divergence, 6 Comedy Engines, Anti-AI Kill List, nhịp `gap` động & ElevenLabs `[tag]`).

## 1. Bốn Trụ Cột (`pipeline.py mix`: 30 / 35 / 20 / 15)
1. **`1 Bíp Cứu Nhà Tèo` (25–30%):** Lừa đảo công nghệ, bẫy vay/link lạ — **hài tình huống** (Tèo sĩ diện + ≥ 1 Visual Gag + Bíp soi kẽ hở), **cấm làm bản tin cảnh báo khô**.
2. **`2 Từ Điển Tiếng Mẹ & Chuyện Nhà` (35%):** Bíp dịch lời nói ngược của Mẹ/gia đình, hài mà ấm.
3. **`3 Tèo & Đồng Lương` (20–25%):** Lương còm, ví rỗng, nợ trà đá, ảo tưởng giàu nhanh, hoặc tập trả lời bình luận nhiều like nhất.
4. **`4 Wildcard / Parody` (15%):** Trí tưởng tượng không giới hạn (`gta6p2` style) — parody game/phim/giả tưởng đời thường miễn lõi con người vẫn là Tèo nghèo Hà Nội & có ≥ 1 hình ảnh/cơ chế chưa từng xuất hiện trên kênh.

## 2. Nhân Vật, Giọng & Lằn Ranh Đỏ
- **Tèo:** Sĩ diện, nghèo thật (< 6tr, nợ Bà chủ 21–25 cốc; tiền to chỉ của Mẹ/chủ nợ). Với Mẹ & Bà chủ luôn 100% lễ phép ("con"/"cháu", "ạ").
- **Bíp:** Mặt lạnh (deadpan), chốt **1–6 âm tiết** sắc gọn; không quát, không giảng đạo, không chửi thề. **CẤM đọc lại tin nhắn trên màn hình** (chỉ nhặt 1 từ khóa lật).
- **Lằn ranh đỏ:** Cấm hỗn Mẹ; cấm chế giễu nạn nhân lừa đảo thật; cấm gag nhảm phá logic sinh tử.
- **Mỏ neo giọng Hà Nội:** Tèo: *"Mẹ tao tâm lý ghê!"* / *"Cháu chuyển luôn ạ!"* · Bíp: *"Mẹ nhớ."* / *"Ba cái tuần sau."* / *"Số lạ. Đừng bấm."* / *"Nợ bà hai tư cốc."*
- **Cấm văn AI/dịch sách giáo khoa:** Xem bảng Kill List trong `WRITERS-ROOM.md`. Bắt buộc có trường `"visual"` ở các beat chốt/im lặng, `gap` động (0,06–0,60 s) và tag ElevenLabs v4 `"say"` trên ≥ 40% câu đắt.

## 3. Ba Chế Độ Nhịp (`"mode"` trong header `beats.json`) & 5 Nhịp Vàng
Chọn đúng chế độ cho từng câu chuyện (không ép 1 khuôn đồng hồ duy nhất):
- **`"comedy"` (mặc định, 30–52 s, tối ưu 34–46 s):** Cười/khịa đầu `< 5,5 s`, cú lật `45–68%`, đuôi `≤ 0,8 s`, kết kép `4–5 s` (phễu/bar10k tùy chọn).
- **`"emotional"` (42–62 s, chuẩn `mekhongcanve`):** Kể chuyện bằng hình ảnh (`35–60%` thoại), móc cảm xúc `< 7,5 s`, cho phép lắng tới `2,5 s` ở đuôi, **CẤM ép CTA/tông đơ/bar10k** — kết bằng 1 câu rất thật hoặc "Rò nước" thật nhẹ. Nên dùng `setswapBackdrop({ backdrop: 'mom_kitchen' })` cho đoạn hồi tưởng bếp Mẹ thay vì dựng set 3D mới tốn thời gian.
- **`"wildcard"` (35–60 s, chuẩn `gta6p2` / `thaylamgiau`):** Parody/ý tưởng táo bạo hoặc **Explainer Hệ Thống** (`boardOverlay`), cú lật `35–75%`, đuôi `≤ 1,5 s`.
- **Chế độ Trình Bày Sơ Đồ 2D (Imagine Diagram Explainer — v3.0):** Khi bóc phốt mô hình lừa đảo, dòng tiền, lương còm hay so sánh sự thật vs quảng cáo, dùng **`boardOverlay`** (`layout: 'flow' | 'corkboard' | 'chart' | 'compare'`) + sticker từ `packs/shared/stickers/catalog.json` + **`rig: diagramRig()`** (nhân vật 3D ngồi nửa dưới ngước `look: 'up'`, sơ đồ 2D stutter 12fps + highlighter + dây đỏ nổi nửa trên `y: 216..756`). Khởi tạo 0 token bằng `tools/scaffold_ep.py --layout flow|corkboard|chart|compare`.

**Khung 5 Nhịp Vàng (áp dụng chặt cho `comedy`, linh hoạt theo nhịp thở ở `emotional`/`wildcard`):**
- **4 dòng đầu kịch bản:** (1) Phản xạ Share Zalo/Messenger, (2) Đánh phủ đầu (`< 5,5 s`), (3) Mồi hài (≥ 1 Visual Gag + Comedy Engine đang dùng + running gag), (4) Gieo & gặt.
- **0–2,5 s (Móc 2 tầng):** `00:00` mặt cận/sự cố ≥ 30–35%. `hook` ≤ 5 từ, tắt 2,0–2,2 s (`y: 345`). Thoại đầu ≤ 6 từ (cảnh báo 7–8 từ), **0 từ trùng hook**. Tắt tiếng vẫn hiểu.
- **2,5–7,5 s (Phủ đầu):** Đòn cười/lật đầu `< 5,5 s` (`comedy`). Không im chết > 0,3 s trong 10 s đầu.
- **7,5–22 s (Leo thang 3 bậc):** Bình thường → Vô lý → Vô lý + Rủi ro thật (dùng 1 trong 6 Comedy Engines trong `WRITERS-ROOM.md`, cấm lặp 2 tập liên tiếp).
- **22–35 s (Cú lật):** Lật từ chi tiết đã gieo ở 10 s đầu, không giảng đạo.
- **Kết kép & Phễu:** Callback hài / "Rò nước" + phễu nhẹ (chỉ dùng khi không phá cảm xúc hoặc loop rewatch).
  - `bar10k: "yes"` tối đa **1/3 tập hài**, **cấm tuyệt đối trên tập `emotional`**.
  - **Combo Hòm Thư (`homThuSlip`) + Bậc Thang Kèo (`questBadge`):** chỉ ghi `% KHÁCH QUÁN → MỐC N`, cấm số follower thô 1 nền tảng, cấm logo/tên app đối thủ.

## 4. Cổng Kịch Bản 8 Điểm + Sàn Giải Trí (`pro` đọc mù, JSON schema)
> **Đọc mù đúng nghĩa:** Cổng nhận lời thoại + `"visual"` + `"note"` + `"card"` + `"sfx"` (để thấy trọn visual gag!), **ẨN** `meta`/logline/treatment.
**ĐẠT:** 8/8 (hoặc 7/8 nếu **#1, #2, #3, #8 PASS** & điểm trượt không đụng logic/độ hài) **VÀ** đủ 4 chốt chặn **VÀ** `first_laugh_s <= 5.5` (`7.5` với `emotional`) **VÀ** **5 Sàn Giải Trí (Kill-Floors) đều ≥ 7/10** (`hook_thumbstop_score`, `comedy_or_emotion_punch_score`, `originality_score`, `dialogue_authenticity_score`, `visual_storytelling_score`):
1. **[BẮT BUỘC]** Đúng Trụ Cột (1–4) & rõ người nhận Share.
2. **[BẮT BUỘC]** Móc 2 tầng 0–2,5 s (≤ 5/≤ 6 từ, 0 trùng) & tắt tiếng vẫn hiểu.
3. **[BẮT BUỘC]** Phủ đầu đúng hạn & Bíp không đọc lặp tin nhắn.
4. DNA hài & nhất quán Tèo–Bíp (lễ phép Mẹ, không giảng đạo, không mùi AI).
5. Leo thang 3 bậc & Cú lật nối nhân-quả từ chi tiết đã gieo.
6. Vệ sinh chữ (≤ 3 cụm/khung, card ≤ 8 từ) & nhịp thoại (câu dài ≤ 4,6 âm/s, TB tập ≤ 4,2 âm/s, ≤ 1 số/câu, không chết tiếng > 1 s).
7. Kết thúc đúng `mode` (không nhồi CTA phá dư vị; có loop rewatch hoặc bình luận sắc).
8. **[BẮT BUỘC]** **Test Người Lạ:** không đọc logline, kể trọn chuyện trong ≤ 2 câu.

## 5. 6 Cửa Phim Cuối (`review_proxy.mp4` xem+nghe mù thật 2 bước)
1. **Móc:** `00:00` mặt cận/sự cố, `hook` tắt ≤ 2,2 s, 10 s đầu không im > 0,3 s.
2. **UI & Manh mối:** `callCard` gọi đi/máy bận **chỉ nút đỏ**; manh mối ≥ 2,0 s; né vùng phải `x > 900` & đáy `y > 1536`.
3. **Diễn xuất & Set:** Visual Gag rõ; tay chạm vật (`touch`/`touchProps`); khớp miệng (`facePlus`) + 180°; không biển phá tâm trạng; nét mực `look2` sạch.
4. **Nhịp cắt:** 12 s đầu trung bình 1,8–2,4 s; không tĩnh > 2,8 s hoặc `two` tĩnh > 2,5 s.
5. **Kết & Phễu:** Đúng `mode` (`comedy`/`emotional`/`wildcard`), đúng luật `bar10k`/Combo, đuôi đúng hạn.
6. **Xuất bản & Âm thanh:** 0% timecode/debug; `1080×1920`, `30fps CFR`, `CRF 17`, `AAC 192k 48kHz`; thoại rõ hơn nhạc, SFX sạch (0 synth lỗi).

## 6. Đăng bài
Lịch **5-1-1** (T2–T6 19:30 Shorts, T7 nghỉ, CN 19:30 16:9). **Cấm "Tập N"** trên tiêu đề. YT/FB: SEO 35–55 ký tự (nỗi đau/con số). TikTok: ≤ 8 từ + 3–4 hashtag + ghim bình luận giọng Tèo/Bíp.

