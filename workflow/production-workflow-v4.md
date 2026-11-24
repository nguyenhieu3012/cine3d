---
Type: quy trình
Status: v4, driver (Fable 5.2) viết 13/11/2026 theo lệnh the owner: "sửa workflow cho chuẩn logic, nâng cấp hệ thống lên, đảm bảo chất lượng, đọc kĩ số liệu các kênh, đưa ra hướng đi cuối cùng". Thay v3 (13/11 sáng). Sản xuất hai kênh đang DỪNG cho tới khi the owner duyệt hướng đi ở mục 7.
Confidence: trung bình. Phần số liệu đo thật (YouTube API 13/11). Phần quy trình chưa chạy qua tập nào: tập đầu tiên làm theo v4 là bài kiểm tra, đo token và ghi lại ở mục 6.
Scope: Trà đá với AI và GOAT Beef, mọi Short dựng bằng cine3d
Source: `04 Work/Workflow v4 (13-11)/` (5 file số liệu, nghiên cứu, soát engine); review 13/11; Sổ tay driver; Playbook
Last seen: 2026-11-13
---
> v2 and v3 of this workflow are archived in `99 Archive/workflow-cu-20261113/`. The operating manual is now the skill `studio-pipeline` (`~/.claude/skills/studio-pipeline/`); this file keeps the reasons and the numbers.

# Workflow v4: ít tập hơn, tập nào cũng qua đủ cửa

## 1. Vì sao phải đổi (4 lỗ hổng của v3, đều có bằng chứng ngày 13/11)
| Lỗ hổng | Bằng chứng | v4 vá bằng |
|---|---|---|
| Không ai học từ số liệu | Từ 9/11 không ai đọc TikTok; ý tưởng mới không dựa vào tập cũ | Sổ số liệu (bước 0 và 11), idea-scout bắt buộc đọc |
| Máy kiểm bỏ sót đúng thứ the owner bắt được | Zombie Phần 1: lún vào cửa, kính rơi, mặt buồn ngủ ở câu sợ, nhạc nhạt; bộ kiểm cũ vẫn ALL PASS | 3 bộ kiểm mới: hình (qa vá), va chạm (clipcheck), tiếng (audiogate) |
| the owner là người đầu tiên thấy lỗi | 13/11 the owner xem 3 bản Zombie còn lỗi | Cổng tập chạy TRƯỚC khi the owner xem; không gửi bản còn lỗi đã biết |

## 2. Nguyên tắc
1. **Chết sớm thì rẻ.** Ý tưởng yếu bị loại ở bước 1 (0 token), không phải sau khi dựng.
2. **Máy đo, agent chấm, driver đạo diễn, the owner chỉ xem bản không còn lỗi đã biết.**
3. **Mỗi điểm mù có người chịu trách nhiệm:** tiếng (máy đo + tai the owner duyệt thư viện nhạc một lần), chuyển động (dải ảnh + máy đo), mạch truyện (người lạ kể lại trước khi thu giọng), tăng trưởng (sổ số liệu).
4. **Không dựng để lấp lịch.** Lịch đăng là trần, không phải chỉ tiêu.
5. **Tập nào cũng để lại dữ liệu:** thẻ nội dung + số sau 72 giờ.
Chuẩn nghề đi kèm: `chuan-dien-anh-v4 (13-11).md` (cùng thư mục).

## 3. Các bước của một tập
| # | Bước | Ai làm (model, effort) | Cửa: qua khi nào | Token ước |
|---|---|---|---|---|
| 0 | Sổ số liệu: `ledger.py update` + đọc TikTok 2 lần/tuần | máy + agent quản lý kênh (Haiku hoặc Sonnet, low) | sổ có số của mọi tập đã đăng quá 72 giờ | ~0–20K/tuần |
| 1 | Ý tưởng: 5 ý, mỗi ý một thẻ (ai trong đời người xem, khoản tiền, khung hình đầu, đóng góp gì cho mạch dài; GOAT: câu gây cãi + phe được chọn) | idea-scout (Sonnet, medium), driver chọn | driver chọn 1; ý không trả lời đủ thẻ thì loại | ~40K/5 ý |
| 2 | Bản đạo diễn 1 trang: phim nói gì, 2–3 cảm xúc theo thứ tự, chuỗi "vì… nên…", đường căng thẳng, 3 giây đầu, giây 4–10, 15 giây cuối, kế hoạch tiếng | driver | driver tự kể lại được bằng 3 câu | nhỏ |
| 3 | Kịch bản + `beats.json` có `tension`, `mood`, `land`, thẻ `meta` | driver hoặc script-writer (Sonnet, high) | `scriptlint.py --strict` PASS (máy) | 0–80K |
| 4 | Cổng kịch bản, một vòng | Trà đá: tdvai-script-reviewer (Sonnet, high). GOAT: goatbeef-cold-reader (Sonnet, medium) + goatbeef-fact-checker (Sonnet, medium) | người lạ kể lại đúng + trả lời được "vì sao họ tới đó"; 10/10; GOAT: đoán được ít nhất 2 bình luận cãi nhau | ~60K |
| 5 | Thu giọng câu thiếu → `voice.py build` → `audiogate.py` | agent thường (Haiku, low) + máy | AUDIO PASS (máy) | ~30K |
| 6 | File tập → `qa.cjs` + `clipcheck.cjs` → bảng ảnh + dải chuyển động cho mọi hành động | cine3d-builder (Sonnet, medium; high nếu có cảnh hành động) | cả hai PASS, miễn trừ nào cũng ghi lý do | ~150K |
| 7 | Driver soát bảng ảnh theo bản đạo diễn, MỘT danh sách sửa, xuất 30 fps (chuẩn từ 23/11; trước đó 60), `smooth.py` | driver + builder (cùng agent, SendMessage) | SMOOTH PASS, driver không còn thấy lỗi | ~30K |
| 8 | Cổng tập, TRƯỚC khi the owner xem: xem mù (không đọc kịch bản), kể lại, đánh dấu chỗ chán, đọc 3 báo cáo máy | tdvai-episode-reviewer (Sonnet, medium); GOAT: cùng agent, brief GOAT | kể lại đúng, không lỗi chặn | ~50K |
| 9 | the owner xem. Kèm một dòng "chưa ai nghe, chưa ai xem ở tốc độ thật" | the owner | the owner duyệt; sửa xong chỉ chạy lại máy + hỏi lại đúng điểm đã sửa | 0–20K |
| 10 | Đăng + bìa + bình luận ghim đúng giọng nhân vật | agent quản lý kênh (Sonnet, low) | đã lên đủ nền tảng, bản nét 30 fps (chuẩn từ 23/11; trước đó 60) | ~30K |
| 11 | Sau 72 giờ: điền sổ, driver ghi một dòng "học được gì" | máy + driver | dòng của tập đủ số | ~0 |
Tổng ước: khoảng 350–400K token agent mỗi tập (v3 ước 300K, cách cũ 1,0M). Chưa đo.

## 4. Lệnh máy (không tốn token; chi tiết ngưỡng ở `~/cine3d/docs/v4-*.md`)
```
python3 tools/scriptlint.py episodes/<id>.beats.json --strict   # đường căng thẳng, vách đá 4–10, mỗi 8 s có điểm rơi
~/tdvai/.venv/bin/python tools/voice.py build episodes/<id>.beats.json
~/tdvai/.venv/bin/python tools/audiogate.py episodes/<id>.beats.json   # độ to, giọng trên nhạc 6 dB, nhạc theo căng thẳng, tiếng trúng nhát cắt
node tools/qa.cjs episodes/<id>.js            # cả cảnh máy quay tự do, mặt khớp câu, chữ
node tools/clipcheck.cjs episodes/<id>.js     # lún, trượt chân, đồ rời, đồ bị nhân đôi
python3 tools/smooth.py <mp4> episodes/<id>.js # giật: chỉ ra cái gì giật, ở giây nào
python3 ~/goat-beef-test/tools/ledger.py update && ... summary
```

## 5. Ai giữ việc gì
- **Driver (phiên chính; the owner 13/11 tối: Fable là driver, tự chọn model cho từng agent):** chọn ý, bản đạo diễn, câu móc và 15 giây cuối, đọc bảng ảnh, danh sách sửa, quyết credit trong trần, trả lời the owner. Không giao xuống.
- **Agent:** tìm ý, chấm cổng, thu giọng, gõ file tập, đăng. Brief có: file được đọc, file được sửa, "xong" là gì, giới hạn báo cáo.
- **Máy:** mọi thứ đếm được.
- **the owner:** duyệt hướng đi, nghe mẫu nhạc một lần, xem bản cuối, cho phép đăng, xoá, tiêu credit vượt trần.

## 6. Việc đo ở tập đầu tiên chạy v4 (điền vào đây)
- Token từng bước (get_usage trước và sau).
- Bộ kiểm mới bắt được gì mà bản cũ bỏ sót; báo động giả bao nhiêu.
- the owner còn bắt được lỗi nào mà cả ba bộ kiểm lẫn cổng tập bỏ sót → thêm vào bộ kiểm, không chỉ sửa tập đó.

## 8. Còn lại của v3 vẫn giữ
Mỗi tập một phiên; ngữ cảnh quá ~150K thì bàn giao; giọng mỗi câu một bản; sửa thì gửi đúng agent cũ; trần 15% hạn mức tuần mỗi ngày; cấm đăng bài chưa qua cả hai cổng và chưa được the owner duyệt.
