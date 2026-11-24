---
Type: ghi chu ky thuat
Status: da ap dung (23/11/2026)
Confidence: cao (da chay thu, regress khong co tap nao moi hong)
Scope: bo kiem may cua engine cine3d (~/cine3d/tools) cho kenh Tra da voi AI
Source: Blueprint v2.0 hop nhat 23/11/2026
Last seen: 2026-11-23
---

# Bo kiem may v2.0 - thay doi (23/11)

Chi ap dung cho kenh Tra da (pack `trada`) khi tap co `rules: 2`. GOAT Beef va moi tap cu (rules 1) giu nguyen, nen khong tap cu nao bi hong them.

## Doi gi: gia tri cu -> gia tri moi

| Cong cu | Kiem cai gi | Cu | Moi |
|---|---|---|---|
| scriptlint | do dai phim | 40-60 s | 42-48 s (bao canh bao khi chi la uoc luong va lech duoi 1 s) |
| scriptlint | doan im sau cau cuoi (tail) | <= 2 s | <= 0.8 s (neu header co `waive` loai `tail` kem ly do thi chi canh bao) |
| scriptlint | ket kep (tu pay-off den het) | 5-6 s | 4-5 s |
| scriptlint | thanh "theo doi" cuoi phim | bat buoc | khong bat buoc (chi hong khi hen gio theo doi sau pay-off) |
| scriptlint | tien cuoi dau tien (first land) | khong co | truoc 5,5 s, chi kiem khi co beat danh dau `land` |
| scriptlint | toc do noi | canh bao > 5,2 am tiet/s | hong neu > 4,2 am tiet/s (can thoi gian that cua giong) |
| scriptlint | so lieu moi cau | toi da 5 so ca phim | them: toi da 1 so moi cau |
| scriptlint | 4 dong tom tat dau tai lieu kich ban | khong co | kiem 4 y (chia se, cu dam dau 5,5 s, tro dua bang hinh, gieo-gat); khong doc duoc tai lieu thi chi canh bao |
| scriptlint | chu hook, cau dau, chu tren man hinh, twist | 5 / 6 / 8 tu, twist 45-68 % | khong doi (da dung) |
| qa | hook roi man hinh | 2,5 s (sai so 0,1) | khong qua 2,2 s |
| qa | tin nhan xuat hien | khong co | khong 2 tin nhan khac nhau hien cung luc (`msg_simultaneous`) |
| qa | so tu tren man hinh | the lon <= 8 tu | moi tin nhan <= 8 tu (`card_words`) |
| qa | thoi gian the lon | 1,75-2,25 s | 1,75-2,55 s (de chua cho the manh moi 2,0-2,5 s) |
| qa | so nhom chu trong 1 khung | khong co | toi da 3 (`text_groups`) |
| qa | canh 2 nguoi dung yen | khong co | toi da 2,5 s (`static_two`) |
| qa | vung an toan chu (1080x1920) | cu | tren y < 220, duoi y > 1536, phai x > 900 khi y 800-1550; phu de y 1260-1450 |
| qa | doan im cuoi (tail) | <= 6 s | <= 0,8 s |
| qa | do dai phim | khong co | 42-48 s (`length`) |
| animatic / pipeline | dai ma thoi gian ghi len phim | mac dinh da tat, nhung cau chu van noi "ghi o goc tren trai" | da sua chu: phim giao khong bao gio co dai ma thoi gian; `--timecode` va `--wide` chi cho ban xem thu |

Gioi han tai lieu kich ban trong brief: 8 KB -> 10 KB (`pipeline/briefs/script.md`). Ly do: hai tai lieu hien co da gan 8,3 KB roi, chua tinh 4 dong tom tat va bang canh quay.

## Khong kiem duoc bang may (can nguoi/agent xem)

- Tin nhan nao la "tin manh moi" (clue) de giu >= 2,0 s: du lieu khong phan biet, nen cua so chung 1,75-2,55 s.
- Vat 3D co chu nam trong vung y 440-1180.
- Tieng cuoi dau tien khi khong co beat nao danh dau `land`: chi canh bao "chua do".
- 4 dong tom tat khi the khong co `script_doc` hoac tro vao chinh Blueprint.
- Thoi diem bat dau pay-off chinh xac khi header khong co `payoff`.
- Khung dau tien co khuon mat/vat chiem >= 30 %.
- SFX som 0,2 s, nhac cat dung luc.
- Xuat 30 hinh/giay va CRF (animatic ghi dung, nhung khong co kiem ban cuoi).
- Y that cua chu hook tren vat 3D.

## Luu y khi doc ket qua

- `v2demo` (phim thu ky thuat 19 s, khong giong) gio hong nhung kiem moi: do dai, tail, ket kep, hook_timing, vung an toan. Day la dung va khong phai tap that; no khong nam trong regress.
- Vi cac cong cu doi, tap rules 2 se hien "inputs changed" cho den khi chay `pipeline.py status <id> --run`.
- `~/.claude/agents/script-writer.md` (dong 3 va 21) van ghi "8 KB": nam ngoai thu muc cong cu, can driver sua.
- Tap `fixt60b` chay qa chi doc: kiem moi bat dung cac loi sau (hook 6 tu, hook 1,95 s, 2 tin nhan cung luc o 3,91 s, 3 the qua 8 tu). Noi dung tap khong sua.
