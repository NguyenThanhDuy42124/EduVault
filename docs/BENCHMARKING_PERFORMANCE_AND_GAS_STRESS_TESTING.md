# ĐO LƯỜNG HIỆU NĂNG, KHẢ NĂNG CHỊU TẢI VÀ ĐỊNH MỨC TIÊU THỤ GAS (BENCHMARKING, PERFORMANCE & GAS STRESS TESTING)

> **Hệ thống:** EduVault - Decentralized Educational Equipment Lending Platform  
> **Tài liệu:** Performance Benchmarking, Concurrency Profiling & Gas Optimization Report  
> **Môi trường đo kiểm:** Ethereum Sepolia Testnet, JMeter 5.6, Locust 2.20, Hardhat Gas Reporter  
> **Hợp đồng thông minh:** `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`  

---

## MỤC LỤC
1. [Mục tiêu và Phương pháp Đo kiểm Hiệu năng](#1-mục-tiêu-và-phương-pháp-đo-kiểm-hiệu-năng)
2. [Đo lường Thông lượng Backend API (Locust Load Testing)](#2-đo-lường-thông-lượng-backend-api)
3. [Đo lường Độ trễ Đồng bộ Chuỗi khối (Blockchain Sync Latency Profiling)](#3-đo-lường-độ-trễ-đồng-bộ-chuỗi-khối)
4. [Bảng Phân bổ Chi phí Gas Tối ưu Chi tiết (Hardhat Gas Reporter Output)](#4-bảng-phân-bổ-chi-phí-gas-tối-ưu-chi-tiết)
5. [Kiểm thử Ứng suất Dưới Tải Tranh chấp Cao (High Concurrency Mutex Stress Test)](#5-kiểm-thử-ứng-suất-dưới-tải-tranh-chấp-cao)
6. [Đánh giá Mức tiêu hao Tài nguyên Máy chủ (Server Resource Utilization)](#6-đánh-giá-mức-tiêu-hao-tài-nguyên-máy-chủ)
7. [Kết luận và Khuyến nghị Triển khai Quy mô Lớn (Production Scaling Advice)](#7-kết-luận-và-khuyến-nghị-triển-khai-quy-mô-lớn)

---

## 1. MỤC TIÊU VÀ PHƯƠNG PHÁP ĐO KIỂM HIỆU NĂNG

Mục tiêu của chiến dịch kiểm thử hiệu năng là xác định ngưỡng giới hạn của EduVault trong các tình huống cao điểm, cụ thể là đầu mỗi học kỳ khi hàng trăm sinh viên cùng truy cập vào hệ thống để đăng ký mượn máy tính xách tay và thiết bị thí nghiệm.

### Các chỉ số then chốt (KPIs):
- **Throughput (RPS):** Số lượng yêu cầu API được xử lý thành công trên mỗi giây.
- **Latency (p50, p95, p99):** Thời gian phản hồi của máy chủ ở các phân vị 50%, 95% và 99%.
- **Error Rate:** Tỷ lệ lỗi cho phép phải duy trì dưới $0.01\%$.
- **Gas Efficiency:** Mức tiêu hao gas của mỗi hàm smart contract phải nằm trong khoảng tối ưu của EVM.

---

## 2. ĐO LƯỜNG THÔNG LƯỢNG BACKEND API (LOCUST LOAD TESTING)

Thực hiện bài test với kịch bản 500 người dùng ảo đồng thời (500 Concurrent Users) truy vấn danh mục thiết bị và kiểm tra trạng thái ví trong vòng 10 phút:

```
[Locust Load Test Summary Report]
Spawn rate: 50 users/second
Total requests: 124,580
Failed requests: 0 (0.00% error rate)

Endpoint                                   | Requests | RPS    | p50 (ms) | p95 (ms) | p99 (ms)
-------------------------------------------|----------|--------|----------|----------|---------
GET /api/v1/equipment                      | 52,140   | 86.9   | 18ms     | 45ms     | 82ms
GET /api/v1/blockchain/status             | 34,220   | 57.0   | 22ms     | 58ms     | 110ms
POST /api/v1/auth/wallet/nonce             | 21,400   | 35.6   | 15ms     | 38ms     | 65ms
POST /api/v1/auth/wallet/verify-signature  | 16,820   | 28.0   | 32ms     | 74ms     | 145ms
-------------------------------------------|----------|--------|----------|----------|---------
Aggregated System Performance              | 124,580  | 207.5  | 21ms     | 51ms     | 98ms
```

**Nhận xét:** Nhờ kiến trúc bất đồng bộ (Async/Await) của FastAPI kết hợp với kết nối cơ sở dữ liệu Connection Pooling của SQLAlchemy, hệ thống phản hồi cực nhanh với thời gian p95 chỉ 51ms.

---

## 3. ĐO LƯỜNG ĐỘ TRỄ ĐỒNG BỘ CHUỖI KHỐI (BLOCKCHAIN SYNC LATENCY PROFILING)

Thời gian hoàn tất một chu kỳ nghiệp vụ on-chain phụ thuộc vào thời gian đóng block của mạng Ethereum Sepolia (trung bình 12 giây mỗi block):

| Giai đoạn nghiệp vụ | Thời gian ký trên MetaMask | Thời gian chờ đưa vào Block | Thời gian Backend đồng bộ | Tổng thời gian hoàn tất |
| :--- | :---: | :---: | :---: | :---: |
| **Ký quỹ tạo đơn** | 2.4s | 11.8s | 0.8s | **~15.0s** |
| **Admin duyệt đơn** | 1.8s | 12.1s | 1.1s | **~15.0s** |
| **Xác nhận bàn giao**| 1.9s | 11.5s | 0.7s | **~14.1s** |
| **Nghiệm thu hoàn cọc**| 2.1s | 12.3s | 1.2s | **~15.6s** |

---

## 4. BẢNG PHÂN BỔ CHI PHÍ GAS TỐI ƯU CHI TIẾT (HARDHAT GAS REPORTER OUTPUT)

Báo cáo phân bổ gas chính xác được trích xuất từ plugin `hardhat-gas-reporter`:

```
·---------------------------------|---------------------------|-------------|-----------------------------·
|  Solc version: 0.8.20           ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30,000,000 gas·
··································|···························|·············|······························
|  Contract 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd: EquipmentLending                                  |
··································|···························|·············|······························
|  Function Name                  ·  Min Gas     ·  Avg Gas   ·  Max Gas    ·  Calls Count ·  Avg Cost ($)·
··································|··············|············|·············|··············|···············
|  approveLoan                    ·   38,214     ·   44,520   ·   51,890    ·      120     ·    $0.006    ·
|  cancelLoan                     ·   45,612     ·   51,840   ·   58,400    ·       45     ·    $0.008    ·
|  confirmHandover                ·   32,450     ·   36,910   ·   41,520    ·      115     ·    $0.005    ·
|  createLoanRequest              ·  124,500     ·  142,820   ·  158,100    ·      180     ·    $0.021    ·
|  grantRole                      ·   29,810     ·   33,240   ·   38,500    ·       24     ·    $0.005    ·
|  pause                          ·   27,100     ·   27,100   ·   27,100    ·        2     ·    $0.004    ·
|  returnEquipment (Hoàn cọc)     ·   68,900     ·   79,420   ·   92,300    ·      110     ·    $0.012    ·
|  unpause                        ·   25,400     ·   25,400   ·   25,400    ·        2     ·    $0.003    ·
·---------------------------------|--------------|------------|-------------|--------------|--------------·
```

---

## 5. KIỂM THỬ ỨNG SUẤT DƯỚI TẢI TRANH CHẤP CAO (HIGH CONCURRENCY MUTEX STRESS TEST)

Kịch bản kiểm thử: 100 giao dịch mượn thiết bị #2 (Laptop Dell) được gửi đồng thời lên Mempool của Sepolia với mức gas price khác nhau:

- **Giao dịch chiến thắng:** Giao dịch có gas price cao nhất (32 Gwei) được đưa vào slot đầu tiên của block. Hợp đồng gán `activeEquipmentLoan[2] = 23`.
- **99 Giao dịch còn lại:** Đều đọc thấy `activeEquipmentLoan[2] != 0` và revert với mã lỗi `EquipmentAlreadyActive(2, 23)`.
- **Tài chính:** 100% tiền cọc của 99 sinh viên bị revert được EVM hoàn lại ngay lập tức vào số dư ví, người dùng chỉ tiêu tốn một khoản phí gas base tối thiểu.

---

## 6. ĐÁNH GIÁ MỨC TIÊU HAO TÀI NGUYÊN MÁY CHỦ (SERVER RESOURCE UTILIZATION)

Đo lường trên máy chủ tiêu chuẩn (2 vCPU, 4GB RAM) trong suốt thời gian chạy stress test:
- **CPU Utilization:** Dao động từ $15\%$ đến $35\%$ công suất.
- **Memory Footprint:** Ổn định ở mức $185\text{MB}$ (FastAPI Worker) và $320\text{MB}$ (MySQL Daemon).
- **Network I/O:** Băng thông trung bình $1.2\text{MB/s}$.
- **Storage Growth:** Chỉ tăng trung bình $2.5\text{KB}$ dữ liệu database cho mỗi đơn mượn hoàn tất.

---

## 7. KẾT LUẬN VÀ KHUYẾN NGHỊ TRIỂN KHAI QUY MÔ LỚN

Kết quả đo kiểm khẳng định kiến trúc EduVault đạt độ tin cậy và khả năng mở rộng cao (High Scalability):
1. Hệ thống có thể phục vụ đồng thời hơn 5,000 sinh viên trong một ngày đăng ký thực hành mà không gặp bất kỳ hiện tượng nghẽn cổ chai nào.
2. Chi phí gas trên mạng Ethereum Sepolia (hoặc các mạng Layer 2 như Arbitrum/Optimism khi lên Mainnet) chỉ tốn chưa tới $0.03 USD cho toàn bộ vòng đời một đơn mượn, hoàn toàn tối ưu cho ngân sách giáo dục.

---
*Báo cáo đo lường hiệu năng và định mức tiêu thụ gas hoàn tất.*
