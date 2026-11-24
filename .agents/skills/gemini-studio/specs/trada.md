# Spec: Trà đá với AI (`trada`) — Blueprint v2.0 (1 Nguồn Sự Thật)

> Mặc định tập mới: `rules: 2, fps: 30, look2: true, act2: true, setOpts: { plus: true, menuBrand: true }` (+ `mailbox: true` khi dùng Hòm Thư). Khán giả VN 25–34t. **Chỉ làm Anthology** (không mở series mới; Zombie đóng; "Quỹ về Tết" đã hủy).

## 1. Ba Trụ Cột (`pipeline.py mix`: 40 / 35 / 25)
1. **`1 Bíp Cứu Nhà Tèo` (40%):** Lừa đảo công nghệ, bẫy vay/link lạ, Bíp soi kẽ hở cứu Tèo/Mẹ.
2. **`2 Từ Điển Tiếng Mẹ & Chuyện Nhà` (35%):** Bíp dịch lời nói ngược của Mẹ/gia đình, hài mà ấm.
3. **`3 Tèo & Đồng Lương` (25%):** Lương còm, ví rỗng, nợ trà đá, ảo tưởng giàu nhanh.

## 2. Nhân Vật, Giọng & Lằn Ranh Đỏ
- **Tèo:** Sĩ diện, nghèo thật (< 6tr, nợ Bà chủ 21–25 cốc; tiền to chỉ của Mẹ/chủ nợ). Với Mẹ & Bà chủ luôn 100% lễ phép ("con"/"cháu", "ạ").
- **Bíp:** Mặt lạnh (deadpan), chốt **1–3 chữ** hoặc 1 câu sắc; không quát, không giảng đạo, không chửi thề. **CẤM đọc lại tin nhắn trên màn hình** (chỉ nhặt 1 từ khóa lật).
- **Lằn ranh đỏ:** Cấm hỗn Mẹ; cấm chế giễu nạn nhân lừa đảo thật; cấm gag nhảm phá logic sinh tử.
- **Mỏ neo giọng Hà Nội:** Tèo: *"Mẹ tao tâm lý ghê!"* / *"Cháu chuyển luôn ạ!"* · Bíp: *"Mẹ nhớ."* / *"Ba cái tuần sau."* / *"Số lạ. Đừng bấm."* / *"Nợ bà hai tư cốc."*

## 3. 5 Nhịp Vàng (42–48 s, tối đa 52 s)
- **4 dòng đầu kịch bản:** (1) Phản xạ Share Zalo/Messenger, (2) Đánh phủ đầu (< 5,5 s), (3) Mồi hài (≥ 1 Visual Gag + running gag), (4) Gieo & gặt.
- **0–2,5 s (Móc 2 tầng):** `00:00` mặt cận/sự cố ≥ 30–35%. `hook` ≤ 5 từ, tắt 2,0–2,2 s (`y: 345`). Thoại đầu ≤ 6 từ, **0 từ trùng hook**. Tắt tiếng vẫn hiểu.
- **2,5–7,5 s (Phủ đầu):** Cười/khịa đầu **< 5,5 s**. Không im chết > 0,3 s trong 10 s đầu.
- **7,5–22 s (Leo thang 3 bậc):** Bình thường → Vô lý → Vô lý + Rủi ro thật.
- **22–35 s (Cú lật 45–68%):** Lật từ chi tiết đã gieo, không giảng đạo.
- **35–45 s (Kết kép 4–5 s sau payoff):** Callback hài hoặc "Rò nước" + phễu. **Đuôi ≤ 0,8 s**.
  - `bar10k: "yes"` tối đa **1/3 tập**, **cấm trên tập cảm động**.
  - **Combo Hòm Thư (`homThuSlip`) + Bậc Thang Kèo (`questBadge`):** chỉ ghi `% KHÁCH QUÁN → MỐC N`, cấm số follower thô 1 nền tảng, cấm logo/tên app đối thủ.

## 4. Cổng Kịch Bản 8 Điểm (`pro` đọc mù, JSON schema)
**ĐẠT:** 8/8, hoặc 7/8 nếu **#1, #2, #3, #8 PASS** & điểm trượt không đụng logic/độ hài (cộng 4 chốt: nhân-quả + ai-biết-gì, không hụt 4–10 s, rõ người nhận share, logic thế giới).
1. **[BẮT BUỘC]** Đúng Trụ Cột & rõ người nhận Share.
2. **[BẮT BUỘC]** Móc 2 tầng 0–2,5 s (≤ 5/≤ 6 từ, 0 trùng) & tắt tiếng vẫn hiểu.
3. **[BẮT BUỘC]** Phủ đầu < 5,5 s & Bíp không đọc lặp tin nhắn.
4. DNA hài & nhất quán Tèo–Bíp (lễ phép Mẹ, không giảng đạo).
5. Leo thang 3 bậc & Cú lật 45–68% nối nhân-quả.
6. Vệ sinh chữ (≤ 3 cụm/khung, card ≤ 8 từ) & nhịp thoại (≤ 4,2 âm/s, ≤ 1 số/câu, không chết tiếng > 1 s).
7. Kết kép 4–5 s đúng luật, đuôi ≤ 0,8 s.
8. **[BẮT BUỘC]** **Test Người Lạ:** không đọc logline, kể trọn chuyện trong ≤ 2 câu.

## 5. 6 Cửa Phim Cuối (`review_proxy.mp4` xem+nghe thật)
1. **Móc:** `00:00` mặt cận/sự cố, `hook` tắt ≤ 2,2 s, 10 s đầu không im > 0,3 s.
2. **UI & Manh mối:** `callCard` gọi đi/máy bận **chỉ nút đỏ**; manh mối ≥ 2,0 s; né vùng phải `x > 900` & đáy `y > 1536`.
3. **Diễn xuất & Set:** Visual Gag rõ; tay chạm vật (`touch`/`touchProps`); khớp miệng + 180°; không biển phá tâm trạng; nét mực `look2` sạch.
4. **Nhịp cắt:** 12 s đầu trung bình 1,8–2,4 s; không tĩnh > 2,8 s hoặc `two` tĩnh > 2,5 s.
5. **Kết kép & Phễu:** 4–5 s, đúng luật `bar10k`/Combo, đuôi ≤ 0,8 s.
6. **Xuất bản & Âm thanh:** 0% timecode/debug; `1080×1920`, `30fps CFR`, `CRF 17`, `AAC 192k 48kHz`; thoại rõ hơn nhạc, SFX sạch (0 synth lỗi).

## 6. Đăng bài
Lịch **5-1-1** (T2–T6 19:30 Shorts, T7 nghỉ, CN 19:30 16:9). **Cấm "Tập N"** trên tiêu đề. YT/FB: SEO 35–55 ký tự (nỗi đau/con số). TikTok: ≤ 8 từ + 3–4 hashtag + ghim bình luận giọng Tèo/Bíp.
