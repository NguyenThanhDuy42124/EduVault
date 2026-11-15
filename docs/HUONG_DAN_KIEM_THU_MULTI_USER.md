# HUONG DAN KIEM THU DA NGUOI DUNG (MULTI-USER E2E TESTING)

Tai lieu huong dan thuc hien kiem thu tich hop lien vi giua cac thanh vien trong nhom (Deployer, Admin 2, Admin 3) va nguoi dung Sinh vien theo kien truc Pure Web3 tren he thong EduVault.

---

## 1. MUC TIEU KIEM THU

1. Kiem chung co che phan quyen phi tap trung AccessControl on-chain:
   - Deployer so huu DEFAULT_ADMIN_ROLE va ADMIN_ROLE.
   - Deployer co the uy quyen ADMIN_ROLE cho thanh vien khac trong nhom.
   - Cac Admin deu co tham quyen cap hoac thu hoi BORROWER_ROLE cho sinh vien.
2. Kiem chung chu trinh muon tra thiet bi cheo vi (Cross-Wallet Lifecycle):
   - Sinh vien: Tu ky tao don muon tren vi cua minh (createLoan).
   - Admin 2: Dung vi rieng phe duyet don (approveLoan) va kich hoat Mutex khoa thiet bi.
   - Admin 3: Dung vi rieng xac nhan ban giao (confirmHandover) va khoa tien coc.
   - Admin 1: Dung vi rieng nghiem thu tra may (confirmReturn), hop dong tu dong tinh phat va hoan coc.
3. Kiem chung tinh toan ven du lieu giua CSDL quan he MySQL va trang thai tren Smart Contract qua he thong Receipt Verifier va Audit Log.

---

## 2. CHUAN BI CAC TAI KHOAN VA VI METAMASK

He thong hoat dong tren mang Ethereum Sepolia Testnet (Chain ID: 11155111) hoac mang Local Hardhat EVM (Chain ID: 31337).

### 2.1. Bang phan cong vi va tai khoan he thong

| Vai tro | Tai khoan Web2 | Mat khau mac dinh | Dia chi vi (Hardhat Node) | Quyen on-chain |
| :--- | :--- | :--- | :--- | :--- |
| Deployer / Admin 1 | admin@eduvault.edu.vn | admin123456 | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | DEFAULT_ADMIN_ROLE, ADMIN_ROLE |
| Admin 2 (Thanh vien nhom) | admin2@eduvault.edu.vn | admin123456 | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | ADMIN_ROLE (do Deployer cap) |
| Admin 3 (Thanh vien nhom) | admin3@eduvault.edu.vn | admin123456 | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | ADMIN_ROLE (do Deployer cap) |
| Sinh vien | sv01@eduvault.edu.vn | student123 | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | BORROWER_ROLE (do Admin cap) |

### 2.2. Huong dan lay SepoliaETH (Neu chay tren Sepolia Testnet)

Moi vi can toi thieu 0.01 - 0.02 SepETH de tra phi gas giao dich:
1. Google Cloud Web3 Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
2. Alchemy Sepolia Faucet: https://sepoliafaucet.com
3. QuickNode Faucet: https://faucet.quicknode.com/ethereum/sepolia
4. PoW Mining Faucet: https://sepolia-faucet.pk910.de

Luu y: Deployer co the nhan SepETH ve vi chinh roi chuyen 0.02 SepETH sang cac vi thanh vien de tiet kiem thoi gian.

### 2.3. Kiem tra so du va role tu dong

Chay script kiem tra so du va quyen cua cac vi:
```powershell
python scripts/check_wallet_balances.py
```

---

## 3. QUY TRINH KIEM THU TUNG BUOC TREN GIAO DIEN WEB

### Buoc 1: Deployer phan quyen Multi-Admin cho thanh vien nhom
1. Dang nhap tai khoan `admin@eduvault.edu.vn` tren trinh duyet.
2. Mo MetaMask, chuyen sang Vi Deployer. Ket noi vi voi website.
3. Tren thanh Navbar, truy cap menu `Phan quyen Web3` (duong dan `/admin/roles`).
4. Tai phan `Quan tri vien Nhom (Multi-Admin)`:
   - Nhap dia chi vi cua Ban 2 (`0x7099...79C8`).
   - Bam nut `Cap quyen Admin`.
   - Cua so MetaMask bat len yeu cau xac nhan ham `addAdmin(address)`. Bam `Confirm`.
   - Cho giao dich duoc xac nhan tren block. Thong bao cap quyen thanh cong hien thi.
   - Thuc hien tuong tu de cap quyen cho Vi cua Ban 3 (`0x3C44...93BC`).

### Buoc 2: Sinh vien dang ky vi va duoc cap quyen muon (BORROWER_ROLE)
1. Mo trinh duyet an danh hoac dang xuat, dang nhap tai khoan Sinh vien `sv01@eduvault.edu.vn`.
2. Mo MetaMask, chuyen sang Vi Sinh vien. Ket noi vi voi website.
3. Neu vi chua xac minh EIP-191, he thong se yeu cau bam `Xac minh vi EIP-191` de ky chu ky dien tu personal_sign lien ket vi voi ma so sinh vien.
4. Dang xuat va dang nhap lai bang tai khoan Admin 2 (`admin2@eduvault.edu.vn`).
5. Chuyen vi MetaMask sang Vi Admin 2.
6. Vao trang `Phan quyen Web3` (`/admin/roles`), cuon xuong phan `Cap quyen Sinh vien (Borrower Role)`.
7. Tim sinh vien `Nguyen Van An` trong danh sach cho duyet:
   - Bam nut `Cap quyen muon on-chain`.
   - Cua so MetaMask bat len yeu cau xac nhan ham `registerBorrower(address)`. Bam `Confirm`.
   - Sau khi giao dich mined, vi sinh vien chinh thuc co `BORROWER_ROLE` tren Smart Contract.

### Buoc 3: Sinh vien tu ky tao don muon (createLoan)
1. Chuyen trinh duyet sang tai khoan Sinh vien va vi MetaMask Sinh vien.
2. Truy cap trang `Thiet bi` (`/equipment`).
3. Chon mot thiet bi o trang thai `SAN SANG` (AVAILABLE), vi du: Laptop Dell Inspiron hoac Kit STM32.
4. Bam `Dang ky muon`:
   - Chon ngay du kien nhan va han chot tra.
   - Nhap ly do muon thiet bi.
   - Bam `Xac nhan & Ky tren MetaMask`.
5. Cua so MetaMask hien len goi ham `createLoan(loanId, equipmentId, studentId, borrower, expectedHandover, dueDate, depositAmount)`.
6. Bam `Confirm`.
7. Sau khi giao dich mined, frontend tu dong gui tx_hash ve backend de luu don o trang thai `PENDING`.
8. Sinh vien vao trang `Don muon cua toi` (`/my-loans`) de xem don vua tao kem ma tx_hash.

### Buoc 4: Admin 2 phe duyet don muon (approveLoan)
1. Dang nhap tai khoan Admin 2, vi MetaMask chuyen sang Vi Admin 2.
2. Vao trang `Quan ly don muon` (`/admin/loans`).
3. Tim don mượn o trang thai `CHO DUYET` (PENDING).
4. Bam nut `Duyet don`:
   - Nhap ghi chu kiem tra the sinh vien.
   - Bam `Duyet don & Ky tren MetaMask`.
5. Cua so MetaMask hien thi ham `approveLoan(loanId)`. Bam `Confirm`.
6. Sau khi giao dich mined, trang thai don chuyen sang `APPROVED`. Thiet bi tren contract bi khoa Mutex on-chain.

### Buoc 5: Admin 3 xac nhan ban giao thiet bi (confirmHandover)
1. Dang nhap tai khoan Admin 3, vi MetaMask chuyen sang Vi Admin 3.
2. Vao trang `Quan ly don muon` (`/admin/loans`).
3. Tim don muon o trang thai `DA DUYET` (APPROVED).
4. Bam nut `Ban giao thiet bi`:
   - Cua so MetaMask bat len goi ham `confirmHandover(loanId)`. Bam `Confirm`.
5. Sau khi giao dich mined, trang thai don chuyen sang `ACTIVE`. Tien coc tren Smart Contract chuyen sang trang thai `LOCKED`.

### Buoc 6: Deployer nghiem thu tra may (confirmReturn)
1. Dang nhap tai khoan Deployer (Admin 1), vi MetaMask chuyen sang Vi Deployer.
2. Vao trang `Quan ly don muon` (`/admin/loans`).
3. Tim don muon o trang thai `DANG MUON` (ACTIVE).
4. Bam nut `Nghiem thu & Nhan may`:
   - Chon hien trang may: `Tot / Nguyen ven` (GOOD).
   - Nhap ghi chu nghiem thu thiet bi.
   - Bam `Xac nhan tra may & Ky tren MetaMask`.
5. Cua so MetaMask bat len goi ham `confirmReturn(loanId, returnCondition)`. Bam `Confirm`.
6. Smart Contract tu dong kiem tra han tra tren chuoi khoi:
   - Tra dung han va nguyen ven: Muc phat 0%, tien coc chuyen sang `REFUNDED`, Mutex thiet bi duoc giai phong.
7. Trang thai don tren giao dien chuyen sang `RETURNED`.

### Buoc 7: Kiem tra doi soat kiem toan toan ven (Audit & Reconciliation)
1. Truy cap trang `Kiem toan & Doi soat` (`/audit`).
2. Xem bang `Nhat ky thao tac (Audit Log)`:
   - Xac nhan tung buoc duoc thuc hien boi dung ID cua tung tai khoan:
     - Don muon do Sinh vien gui.
     - Duyet don ghi nhan ma ID cua Admin 2.
     - Ban giao ghi nhan ma ID cua Admin 3.
     - Tra may ghi nhan ma ID cua Deployer (Admin 1).
3. Bam `Doi soat toan he thong`:
   - He thong tra ve trang thai `SYNCED` 100%, 0 loi lech du lieu giua MySQL va Blockchain.

---

## 4. CHAY KIEM THU TU DONG HOA TOAN BO CHU TRINH (CLI E2E)

Co the chay bo kiem thu tu dong hoa mo phong day du 4 vi tren:
```powershell
# Chay kich ban E2E Multi-User
python scripts/test_phase16_multi_user_e2e.py

# Chay bo kiem thu Pytest tich hop
pytest backend/tests/test_multi_user_e2e.py -v
```

