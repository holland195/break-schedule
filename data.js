// ═══════════════════════════════════════════════
//  CONSTANTS & SEED DATA
// ═══════════════════════════════════════════════
const STORAGE  = 'bsched_v5';
const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ── STAFF_INFO_DB: imported from Staff_Info.xlsx ──
// Fields: id, empNo, name, username, gender, dob, role, password, team, schedule
const STAFF_INFO_DB = [{"id": 5000, "empNo": "AGM0003", "name": "Phạm Minh Cường", "username": "cuong.pham", "gender": "M", "dob": "19/05/1989", "role": "Agent Leader", "password": "1234", "team": "", "schedule": {}}, {"id": 5001, "empNo": "AGM0004", "name": "Trần Thái Sơn", "username": "son.tran", "gender": "M", "dob": "10/02/1988", "role": "Agent Training Manager", "password": "1234", "team": "", "schedule": {}}, {"id": 5002, "empNo": "AGF0009", "name": "Trần Thị Kim Anh", "username": "anh.tran", "gender": "F", "dob": "20/01/1995", "role": "Agent Training Assistant", "password": "1234", "team": "", "schedule": {}}, {"id": 5003, "empNo": "AGF0016", "name": "Huỳnh Thị Mỹ Kim", "username": "kim.huynh", "gender": "F", "dob": "25/04/1997", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5004, "empNo": "AGM0024", "name": "Lê Văn Tú", "username": "tu.le", "gender": "M", "dob": "05/08/1997", "role": "Agent Training Assistant", "password": "1234", "team": "", "schedule": {}}, {"id": 5005, "empNo": "AGF0026", "name": "Nguyễn Thị Anh Phương", "username": "phuong.nguyen", "gender": "F", "dob": "27/11/1996", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5006, "empNo": "AGM0034", "name": "Nguyễn Trần Tông", "username": "tong.nguyen", "gender": "M", "dob": "12/06/1997", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5007, "empNo": "AGM0036", "name": "Nguyễn Hữu Thịnh", "username": "thinh.nguyen", "gender": "M", "dob": "21/12/1987", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5008, "empNo": "AGF0039", "name": "Trịnh Mỹ Nhân", "username": "nhan.trinh", "gender": "F", "dob": "01/01/1996", "role": "Agent Training Assistant", "password": "1234", "team": "", "schedule": {}}, {"id": 5009, "empNo": "AGF0040", "name": "Trần Hà Phương Uyên", "username": "uyen.tran", "gender": "F", "dob": "02/07/1998", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5010, "empNo": "AGM0042", "name": "Trần Quốc Dũng", "username": "dung.tran", "gender": "M", "dob": "21/06/1992", "role": "Agent Leader", "password": "1234", "team": "", "schedule": {}}, {"id": 5011, "empNo": "AGM0043", "name": "Tô Hoài Tâm", "username": "tam.to", "gender": "M", "dob": "20/09/1993", "role": "Agent Leader", "password": "1234", "team": "", "schedule": {}}, {"id": 5012, "empNo": "AGM0044", "name": "Nguyễn Đức Thanh", "username": "thanh.nguyen", "gender": "M", "dob": "26/12/1996", "role": "Agent Supervisor", "password": "1234", "team": "", "schedule": {}}, {"id": 5013, "empNo": "AGM0046", "name": "Trần Đình Tú", "username": "dinhtu.tran", "gender": "M", "dob": "29/08/1995", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5014, "empNo": "AGM0053", "name": "Nguyễn Tấn Tú", "username": "tu.nguyentan", "gender": "M", "dob": "30/10/1997", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5015, "empNo": "AGF0054", "name": "Nguyễn Thị Phương Hồng Thuỷ", "username": "hongthuy.nguyen", "gender": "F", "dob": "15/08/1998", "role": "Agent Leader", "password": "1234", "team": "", "schedule": {}}, {"id": 5016, "empNo": "AGM0058", "name": "Đào Công Tấn Anh", "username": "anh.dao", "gender": "M", "dob": "23/10/1994", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5017, "empNo": "AGM0066", "name": "Ngô Trung Nhật", "username": "nhat.ngo", "gender": "M", "dob": "29/12/1996", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5018, "empNo": "AGF0069", "name": "Võ Hoàng Gia Bảo", "username": "bao.vo", "gender": "F", "dob": "04/07/1998", "role": "Sr Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5019, "empNo": "AGM0071", "name": "Nguyễn Hồ Giang Hải", "username": "hai.nguyen", "gender": "M", "dob": "23/12/1997", "role": "Agent Supervisor", "password": "1234", "team": "", "schedule": {}}, {"id": 5020, "empNo": "AGM0072", "name": "Nguyễn Đức Hòa", "username": "hoa.nguyen", "gender": "M", "dob": "25/11/1996", "role": "Agent Supervisor", "password": "1234", "team": "", "schedule": {}}, {"id": 5021, "empNo": "AGF0078", "name": "Lê Thị Quỳnh Như", "username": "nhu.le", "gender": "F", "dob": "08/09/1997", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5022, "empNo": "AGM0080", "name": "Huỳnh Minh Duy", "username": "duy.huynh", "gender": "M", "dob": "25/01/1994", "role": "Agent Supervisor", "password": "1234", "team": "", "schedule": {}}, {"id": 5023, "empNo": "AGF0085", "name": "Trần Thị Phương Trang", "username": "trang.tran", "gender": "F", "dob": "15/06/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5024, "empNo": "AGF0089", "name": "Nguyễn Ngọc Thương Thảo", "username": "thao.nguyen", "gender": "F", "dob": "26/06/1994", "role": "Sr Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5025, "empNo": "AGM0091", "name": "Trần Tấn Sang", "username": "sang.tran", "gender": "M", "dob": "08/02/1995", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5026, "empNo": "AGF0093", "name": "Nhữ Thị Hiền", "username": "hien.nhu", "gender": "F", "dob": "20/04/1999", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5027, "empNo": "AGM0094", "name": "Cao Đức Hiếu", "username": "hieu.cao", "gender": "M", "dob": "01/10/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5028, "empNo": "AGF0097", "name": "Nguyễn Đặng Ngọc Giàu", "username": "giau.nguyen", "gender": "F", "dob": "22/04/1998", "role": "Sr Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5029, "empNo": "AGM0102", "name": "Trần Thanh Hà", "username": "thanhha.tran", "gender": "M", "dob": "12/05/1995", "role": "Sr Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5030, "empNo": "AGF0107", "name": "Nguyễn Thị Kim Chi", "username": "chi.nguyen", "gender": "F", "dob": "21/02/1993", "role": "Sr Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5031, "empNo": "AGF0109", "name": "Trần Thị Ngọc Ánh", "username": "ngocanh.tran", "gender": "F", "dob": "11/10/1999", "role": "Agent Leader", "password": "1234", "team": "", "schedule": {}}, {"id": 5032, "empNo": "AGF0112", "name": "Văn Thị Ngọc Linh", "username": "linh.van", "gender": "F", "dob": "18/02/1996", "role": "", "password": "1234", "team": "", "schedule": {}}, {"id": 5033, "empNo": "AGM0113", "name": "Nguyễn Huy Hiền", "username": "huyhien.nguyen", "gender": "M", "dob": "13/10/1993", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5034, "empNo": "AGF0114", "name": "Trầm Thùy Trang", "username": "trang.tram", "gender": "F", "dob": "27/09/1996", "role": "", "password": "1234", "team": "", "schedule": {}}, {"id": 5035, "empNo": "AGF0115", "name": "Mai Hà Bảo Trâm", "username": "tram.mai", "gender": "F", "dob": "10/04/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5036, "empNo": "AGF0116", "name": "Lê Nguyễn Huyền Trân", "username": "tran.le", "gender": "F", "dob": "29/10/1995", "role": "", "password": "1234", "team": "", "schedule": {}}, {"id": 5037, "empNo": "AGM0117", "name": "Nguyễn Hữu Thiện", "username": "thien.nguyen", "gender": "M", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5038, "empNo": "AGM0118", "name": "Nguyễn Trung Kiên", "username": "kien.nguyen", "gender": "M", "dob": "31/05/1999", "role": "", "password": "1234", "team": "", "schedule": {}}, {"id": 5039, "empNo": "AGF0119", "name": "Nguyễn Thị Ánh Mỹ", "username": "my.nguyen", "gender": "F", "dob": "27/09/1999", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5040, "empNo": "AGF0120", "name": "Nguyễn Lê Như Ý", "username": "y.nguyen", "gender": "F", "dob": "22/09/1994", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5041, "empNo": "AGF0122", "name": "Hồ Thị Tú Trinh", "username": "trinh.ho", "gender": "F", "dob": "", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5042, "empNo": "AGM0123", "name": "Huỳnh Văn Danh", "username": "danh.huynh", "gender": "M", "dob": "", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5043, "empNo": "AGM0124", "name": "Lê Công Triết", "username": "triet.le", "gender": "M", "dob": "19/02/1998", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5044, "empNo": "AGM0126", "name": "Nguyễn Văn Trưởng", "username": "truong.nguyen", "gender": "M", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5045, "empNo": "AGM0127", "name": "Thông Nhát", "username": "thong.nhat", "gender": "M", "dob": "", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5046, "empNo": "AGM0129", "name": "Bùi Trọng Sơn", "username": "son.bui", "gender": "M", "dob": "27/08/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5047, "empNo": "AGM0131", "name": "Hồ Tấn Phúc", "username": "phuc.ho", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5048, "empNo": "AGM0132", "name": "Lê Hoàng Anh Tú", "username": "tu.lehoang", "gender": "M", "dob": "2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5049, "empNo": "AGM0133", "name": "Nguyễn Quốc Duy", "username": "duy.nguyenquoc", "gender": "M", "dob": "07/10/1994", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5050, "empNo": "AGM0134", "name": "Nguyễn Thành Nam", "username": "nam.nguyenthanh", "gender": "M", "dob": "30/05/1994", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5051, "empNo": "AGF0135", "name": "Trần Ngọc Trâm", "username": "tram.tranngoc", "gender": "F", "dob": "1999", "role": "Sr QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5052, "empNo": "AGM0136", "name": "Nguyễn Hoàng Duy Khang", "username": "khang.nguyen", "gender": "M", "dob": "1999", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5053, "empNo": "AGM0138", "name": "Bùi Nhật Anh", "username": "anh.bui", "gender": "M", "dob": "1994", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5054, "empNo": "AGF0139", "name": "Thái Thị Thanh Linh", "username": "linh.thai", "gender": "F", "dob": "1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5055, "empNo": "AGM0140", "name": "Vũ Trung Kiên", "username": "kien.vu", "gender": "M", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5056, "empNo": "AGM0141", "name": "Nguyễn Anh Vũ", "username": "vu.nguyen", "gender": "M", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5057, "empNo": "AGF0142", "name": "Hồ Thị Hải Yến", "username": "yen.ho", "gender": "F", "dob": "1993", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5058, "empNo": "AGF0144", "name": "Nguyễn Thị Phương Anh", "username": "anh.nguyen", "gender": "F", "dob": "1996", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5059, "empNo": "AGM0147", "name": "Trần Trọng Tuấn", "username": "tuan.tran", "gender": "M", "dob": "1997", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5060, "empNo": "AGM0148", "name": "Hồ Quốc Toàn", "username": "toan.ho", "gender": "M", "dob": "06/03/2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5061, "empNo": "AGM0149", "name": "Nguyễn Huỳnh Quốc Duy", "username": "duy.nguyenhuynhquoc", "gender": "M", "dob": "09/04/2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5062, "empNo": "AGM0150", "name": "Nguyễn Thanh Thiện", "username": "thien.nguyenthanh", "gender": "M", "dob": "16/07/2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5063, "empNo": "AGM0151", "name": "Phạm Hà Duy Tân", "username": "tan.pham", "gender": "M", "dob": "10/11/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5064, "empNo": "AGF0152", "name": "Trương Thị Như Ngọc", "username": "ngoc.truong", "gender": "F", "dob": "08/05/1998", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5065, "empNo": "AGF0153", "name": "Ngô Thục Oanh", "username": "oanh.ngo", "gender": "F", "dob": "02/05/1994", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5066, "empNo": "AGM0154", "name": "Nguyễn Phạm Thanh Bình", "username": "binh.nguyen", "gender": "M", "dob": "1997", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5067, "empNo": "AGM0155", "name": "Bùi Lập Duy", "username": "duy.bui", "gender": "M", "dob": "1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5068, "empNo": "AGM0160", "name": "Nguyễn Tuyên Hoàng", "username": "hoang.nguyentuyen", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5069, "empNo": "AGF0161", "name": "Nguyễn Huỳnh Ý Như", "username": "nhu.nguyen", "gender": "F", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5070, "empNo": "AGF0163", "name": "Phạm Thị Hiền", "username": "hien.phamthi", "gender": "F", "dob": "", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5071, "empNo": "AGM0164", "name": "Huỳnh Tấn Phát", "username": "phat.huynhtan", "gender": "M", "dob": "20/04/1995", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5072, "empNo": "AGM0165", "name": "Lê Huỳnh Minh Anh", "username": "anh.le", "gender": "F", "dob": "28/09/1997", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5073, "empNo": "AGM0166", "name": "Ngô Minh Đức", "username": "duc.ngominh", "gender": "M", "dob": "05/09/1996", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5074, "empNo": "AGF0167", "name": "Lê Khả Nhi", "username": "nhi.le", "gender": "F", "dob": "", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5075, "empNo": "AGF0168", "name": "Huỳnh Thị Thanh Huyền", "username": "huyen.huynh", "gender": "F", "dob": "1998", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5076, "empNo": "AGF0169", "name": "Khổng Thị Quỳnh Như", "username": "nhu.khong", "gender": "F", "dob": "17/10/2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5077, "empNo": "AGF0170", "name": "Nguyễn Thị Hòa", "username": "hoa.nguyenthi", "gender": "F", "dob": "13/11/1998", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5078, "empNo": "AGM0171", "name": "Nguyễn Trần Khai Nguyên", "username": "nguyen.nguyentran", "gender": "M", "dob": "12/07/1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5079, "empNo": "AGM0172", "name": "Phạm Văn Thắng", "username": "thang.pham", "gender": "M", "dob": "08/10/2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5080, "empNo": "AGM0173", "name": "Nguyễn Lâm Bảo Ngọc", "username": "ngoc.nguyen", "gender": "M", "dob": "09/11/1997", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5081, "empNo": "AGM0174", "name": "Nguyễn Thành Nhân", "username": "nhan.nguyenthanh", "gender": "M", "dob": "5/8/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5082, "empNo": "AGM0175", "name": "Nguyễn Thành Quang", "username": "quang.nguyenthanh", "gender": "M", "dob": "10/10/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5083, "empNo": "AGM0179", "name": "Trần Gia Huy", "username": "huy.tran", "gender": "M", "dob": "19/05/1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5084, "empNo": "AGM0180", "name": "Nguyễn Thanh Phong", "username": "phong.nguyen", "gender": "M", "dob": "01/11/1998", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5085, "empNo": "AGM0181", "name": "Lê Khương Duy", "username": "duy.le", "gender": "M", "dob": "30/01/2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5086, "empNo": "AGF0182", "name": "Phan Thị Phương Thảo", "username": "thao.phan", "gender": "F", "dob": "24/04/2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5087, "empNo": "AGM0183", "name": "Nguyễn Hoàng Thiên Ân", "username": "an.nguyen", "gender": "M", "dob": "26/06/1990", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5088, "empNo": "AGM0184", "name": "Phan Thái Bảo", "username": "bao.phan", "gender": "M", "dob": "13/09/2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5089, "empNo": "AGM0185", "name": "Nguyễn Đình Nam", "username": "nam.nguyendinh", "gender": "M", "dob": "2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5090, "empNo": "AGM0187", "name": "Cao Chí Hải", "username": "hai.cao", "gender": "M", "dob": "1999", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5091, "empNo": "AGM0188", "name": "Phan Xuân Thịnh", "username": "thinh.phanxuan", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5092, "empNo": "AGM0189", "name": "Võ Anh Kiệt", "username": "kiet.voanh", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5093, "empNo": "AGM0190", "name": "Nguyễn Mai Việt Tính", "username": "tinh.nguyenmaiviet", "gender": "M", "dob": "1997", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5094, "empNo": "AGM0191", "name": "Nguyễn Đinh Lưu", "username": "luu.nguyendinh", "gender": "M", "dob": "1999", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5095, "empNo": "AGM0192", "name": "Vũ Đình Nguyễn", "username": "nguyen.vudinh", "gender": "M", "dob": "2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5096, "empNo": "AGM0193", "name": "Nguyễn Thanh Thế Cường", "username": "cuong.nguyenthanhthe", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5097, "empNo": "AGM0194", "name": "Nhâm Bổn Tường", "username": "tuong.nhambon", "gender": "M", "dob": "1994", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5098, "empNo": "AGM0195", "name": "Phạm Đỗ Duy Quang", "username": "quang.phamdoduy", "gender": "M", "dob": "1994", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5099, "empNo": "AGF0196", "name": "Ngô Diễm Thùy", "username": "thuy.ngodiem", "gender": "F", "dob": "1995", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5100, "empNo": "AGM0197", "name": "Lư Quang Trực", "username": "truc.luquang", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5101, "empNo": "AGM0198", "name": "Phan Trung Phong", "username": "phong.phantrung", "gender": "M", "dob": "1997", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5102, "empNo": "AGM0199", "name": "Trịnh Hoài Phong", "username": "phong.trinhhoai", "gender": "M", "dob": "1994", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5103, "empNo": "AGM0200", "name": "Phạm Công Danh", "username": "danh.phamcong", "gender": "M", "dob": "2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5104, "empNo": "AGM0201", "name": "Nguyễn Mai Khánh Tâm", "username": "tam.nguyenmaikhanh", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5105, "empNo": "AGF0202", "name": "Ân Hồng Kim Ý", "username": "y.anhongkim", "gender": "F", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5106, "empNo": "AGF0203", "name": "Lương Thị Ngân", "username": "ngan.luongthi", "gender": "F", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5107, "empNo": "AGF0204", "name": "Huỳnh Tuyết Ngân", "username": "ngan.huynhtuyet", "gender": "F", "dob": "2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5108, "empNo": "AGF0207", "name": "Huỳnh Trần Uyển Nhi", "username": "nhi.huynhtranuyen", "gender": "F", "dob": "2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5109, "empNo": "AGF0208", "name": "Nguyễn Thị Thanh Diễm", "username": "diem.nguyenthithanh", "gender": "F", "dob": "2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5110, "empNo": "AGF0209", "name": "Lưu Ngọc Mai", "username": "mai.luungoc", "gender": "F", "dob": "2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5111, "empNo": "AGM0210", "name": "Trần Tuấn Anh", "username": "anh.trantuan", "gender": "M", "dob": "2001", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5112, "empNo": "AGF0211", "name": "Nguyễn Thị Hồng Quế", "username": "que.nguyenthihong", "gender": "F", "dob": "2000", "role": "QA", "password": "1234", "team": "", "schedule": {}}, {"id": 5113, "empNo": "AGM0212", "name": "Võ Tuấn Vĩ", "username": "vi.votuan", "gender": "M", "dob": "2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5114, "empNo": "AGM0213", "name": "Nguyễn Hoàng Phú", "username": "phu.nguyenhoang", "gender": "M", "dob": "06/09/2002", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5115, "empNo": "AGM0214", "name": "Hoàng Lạp Kim", "username": "kim.hoanglap", "gender": "M", "dob": "09/12/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5116, "empNo": "AGM0217", "name": "Kiều Huỳnh Minh", "username": "minh.kieuhuynh", "gender": "M", "dob": "09/01/2001", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5117, "empNo": "AGM0222", "name": "Nguyễn Khánh Duy", "username": "duy.nk", "gender": "M", "dob": "29/11/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5118, "empNo": "AGF0223", "name": "Phan Thị Trúc Linh", "username": "linh.ptt", "gender": "F", "dob": "21/12/1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5119, "empNo": "AGM0225", "name": "Hồ Trọng Thiện", "username": "thien.ht", "gender": "M", "dob": "24/06/2002", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5120, "empNo": "AGM0226", "name": "Nguyễn Hữu Thọ", "username": "tho.nh", "gender": "M", "dob": "9/1/1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5121, "empNo": "AGM0227", "name": "Nguyễn Viết Đức", "username": "duc.nv", "gender": "M", "dob": "11/11/2002", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5122, "empNo": "AGM0228", "name": "Nguyễn Phương Nam", "username": "nam.np", "gender": "M", "dob": "18/01/1999", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5123, "empNo": "AGF0229", "name": "Phan Hoàng Chin Na", "username": "na.phc", "gender": "F", "dob": "27/10/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5124, "empNo": "AGM0230", "name": "Phạm Sỹ Thái", "username": "thai.ps", "gender": "M", "dob": "6/11/2002", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5125, "empNo": "AGM0231", "name": "Nguyễn Bảo Thái Tú", "username": "tu.nbt", "gender": "M", "dob": "25/06/2003", "role": "Agent", "password": "1234", "team": "", "schedule": {}}, {"id": 5126, "empNo": "AGM0232", "name": "Đỗ Lê Quốc Thành", "username": "thanh.dlq", "gender": "M", "dob": "16/03/2000", "role": "Agent", "password": "1234", "team": "", "schedule": {}}];

// const SEED_USERS = [
//   { id:999,  username:'admin',           name:'System Admin',                   gender:'M', team:'HQ', role:'Admin',           password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:1001, username:'cuong.pham',      name:'Phạm Minh Cường',                gender:'M', team:'L1', role:'Agent Leader',    password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:1002, username:'hongthuy.nguyen', name:'Nguyễn Thị Phương Hồng Thuỷ',   gender:'F', team:'L2', role:'Agent Leader',    password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:1003, username:'dung.tran',       name:'Trần Quốc Dũng',                 gender:'M', team:'L3', role:'Agent Leader',    password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:1004, username:'ngocanh.tran',    name:'Trần Thị Ngọc Ánh',              gender:'F', team:'L4', role:'Agent Leader',    password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:1005, username:'tam.to',          name:'Tô Hoài Tâm',                    gender:'F', team:'L5', role:'Agent Leader',    password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:2001, username:'hai.nguyen',      name:'Nguyễn Hồ Giang Hải',            gender:'M', team:'S1', role:'Agent Supervisor',password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:2002, username:'thanh.nguyen',    name:'Nguyễn Đức Thanh',               gender:'M', team:'S2', role:'Agent Supervisor',password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:2003, username:'duy.huynh',       name:'Huỳnh Minh Duy',                 gender:'M', team:'S3', role:'Agent Supervisor',password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:2004, username:'tran.le',         name:'Lê Nguyễn Huyền Trân',           gender:'F', team:'S4', role:'Agent Supervisor',password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
//   { id:2005, username:'hoa.nguyen',      name:'Nguyễn Đức Hòa',                 gender:'M', team:'S5', role:'Agent Supervisor',password:'1234', schedule:{Mon:'E',Tue:'E',Wed:'E',Thu:'E',Fri:'E',Sat:'0',Sun:'0'} },
// ];

const DEFAULT_ADMIN = {
  username: 'admin',
  name: 'System Admin',
  role: 'admin',
  team: 'SYSTEM',

  password: '1234',
  mustChangePw: true
};

const SHIFTS = {
  A:{label:'Shift A',start:'15:00',end:'00:00',display:'3:00 PM → 12:00 AM',color:'var(--A-color)',bg:'var(--A-bg)'},
  B:{label:'Shift B',start:'19:00',end:'04:00',display:'7:00 PM → 4:00 AM', color:'var(--B-color)',bg:'var(--B-bg)'},
  C:{label:'Shift C',start:'21:00',end:'06:00',display:'9:00 PM → 6:00 AM', color:'var(--C-color)',bg:'var(--C-bg)'},
  D:{label:'Shift D',start:'00:00',end:'09:00',display:'12:00 AM → 9:00 AM',color:'var(--D-color)',bg:'var(--D-bg)'},
  E:{label:'Shift E',start:'06:00',end:'15:00',display:'6:00 AM → 3:00 PM', color:'var(--E-color)',bg:'var(--E-bg)'},
};

const BREAK_SLOTS = {
  A:['18:00–19:30','19:30–21:00'],
  B:['22:00–23:30','23:30–01:00'],
  C:['01:00–02:30','02:30–04:00'],
  D:['04:00–05:30','05:30–07:00'],
  E:['09:30–11:00','11:00–12:30'],
};

const ROLES = {
  'Admin':            {level:3,tag:'role-leader',label:'Admin'},
  'Agent Leader':     {level:2,tag:'role-leader',label:'Leader'},
  'Agent Supervisor': {level:2,tag:'role-leader',label:'Supervisor'},
  'Sr Agent':         {level:1,tag:'role-agent', label:'Sr Agent'},
  'Agent':            {level:1,tag:'role-agent', label:'Agent'},
  'QA':               {level:1,tag:'role-qa',    label:'QA'},
  'Sr QA':            {level:1,tag:'role-qa',    label:'Sr QA'},
};

// ═══════════════════════════════════════════════
//  STATE — localStorage flat DB
//  Tables: users, breaks, requests, extBreaks, staffInfo, session
// ═══════════════════════════════════════════════
function load() {
  try { const d = localStorage.getItem(STORAGE); if (d) return JSON.parse(d); } catch(e){}
  return { users:[], breaks:{}, requests:[], extBreaks:{}, staffInfo:{}, session:null, imported:false };
}
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch(e){}
}

const DB = {
  getUsers:     ()            => state.users,
  getUser:      id            => state.users.find(u=>u.id===id),
  upsertUser:   u             => { const i=state.users.findIndex(x=>x.id===u.id); if(i>=0) state.users[i]={...state.users[i],...u}; else state.users.push(u); save(); },
  getBreak:     (uid,day)     => state.breaks[`${uid}_${day}`],
  setBreak:     (uid,day,d)   => { state.breaks[`${uid}_${day}`]=d; save(); },
  getRequests:  ()            => state.requests,
  addRequest:   r             => { state.requests.unshift(r); save(); },
  updateRequest:(i,r)         => { state.requests[i]={...state.requests[i],...r}; save(); },
  getExtBreaks: (uid,mk)      => (state.extBreaks[`${uid}_${mk}`]||[]),
  addExtBreak:  (uid,mk,e)    => { const k=`${uid}_${mk}`; if(!state.extBreaks[k]) state.extBreaks[k]=[]; state.extBreaks[k].push(e); save(); },
  deleteExtBreak:(uid,mk,i)   => { const k=`${uid}_${mk}`; if(state.extBreaks[k]){state.extBreaks[k].splice(i,1);save();} },
  countExtBreaks:(uid,mk)     => (state.extBreaks[`${uid}_${mk}`]||[]).length,
  // staffInfo: username → {empNo, dob, gender, role}
  getStaffInfo: username      => state.staffInfo[username] || null,
  setStaffInfo: (username,d)  => { state.staffInfo[username]=d; save(); },
  // session persistence
  saveSession:  s             => { state.session=s; save(); },
  clearSession: ()            => { state.session=null; save(); },
  getSession:   ()            => state.session,
};

let state = load();
// Migrations
if (!state.extBreaks) { state.extBreaks={}; }
if (!state.staffInfo) { state.staffInfo={}; }
if (!state.session)   { state.session=null; }
// if (state.users.length===0) { state.users=SEED_USERS; }
if (state.users.length===0)

// Seed staffInfo from STAFF_INFO_DB on first load
if (Object.keys(state.staffInfo).length === 0) {
  STAFF_INFO_DB.forEach(r => {
    state.staffInfo[r.username] = { empNo:r.empNo, dob:r.dob, gender:r.gender, name:r.name, role:r.role };
  });
}
save();

// ── Runtime state ──
let currentUser  = null;
let currentShift = 'E';
let currentPage  = 'dashboard';
let assigningEmp = null;
let activeMonday  = '20/04';
let showFullMonth = false;
let staffFilters  = { team:'', name:'', user:'', role:'' };
let staffSubTab   = 'info'; // 'info' | 'schedule'
let importedUsers = [];

// ── Theme ──
let currentTheme = localStorage.getItem('bsched_theme') || 'dark';
function applyTheme(t) {
  currentTheme = t;
  localStorage.setItem('bsched_theme', t);
  document.documentElement.setAttribute('data-theme', t);
}
applyTheme(currentTheme);

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function isLeader(u) { return u && (ROLES[u.role]?.level||0)>=2; }
function isAdmin(u)  { return u && (ROLES[u.role]?.level||0)===3; }
function getRoleInfo(r) { return ROLES[r]||{level:0,tag:'role-agent',label:r||'—'}; }

function todayKey() {
  const d=new Date(); return WEEK_DAYS[d.getDay()===0?6:d.getDay()-1];
}
function getShiftMates(shift,day) {
  return state.users.filter(u => {
    const s = u.schedule[day||todayKey()];
    return s===shift;
  });
}
function getBreakKey(uid,day)  { return `${uid}_${day||todayKey()}`; }
function getAssigned(uid,day)  { return DB.getBreak(uid, day||todayKey()); }
function assign(uid,day,slot,note) {
  DB.setBreak(uid, day||todayKey(), {slot, note:note||'', by:currentUser?.id, at:Date.now()});
}
function currentMonthKey() {
  const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
function monthKeyFromDate(ds) {
  const [,m]=ds.split('/'); return `2026-${m.padStart(2,'0')}`;
}
function getShortSlot(shift,fullTime) {
  if(!fullTime||fullTime==='—') return '';
  const idx=(BREAK_SLOTS[shift]||[]).indexOf(fullTime);
  return idx!==-1?`${shift}${idx+1}`:fullTime;
}
function getWeekRange(monStr) {
  const [d,m]=monStr.split('/'), range=[];
  const start=new Date(2026,parseInt(m)-1,parseInt(d));
  for(let i=0;i<7;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i);
    range.push(`${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`);
  }
  return range;
}
function getWkDay(ds) {
  const [d,m]=ds.split('/');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(2026,parseInt(m)-1,parseInt(d)).getDay()];
}
function getWeekDates() {
  const now=new Date(),day=now.getDay();
  const diff=now.getDate()-day+(day===0?-6:1);
  const mon=new Date(now.setDate(diff));
  return WEEK_DAYS.map((_,i)=>{
    const dt=new Date(mon); dt.setDate(mon.getDate()+i);
    return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
  });
}
function buildDatalist() {
  const dl=document.getElementById('user-list');
  if(dl) dl.innerHTML=state.users.map(u=>`<option value="${u.username}">${u.name} (${u.team||'—'})</option>`).join('');
}
function updateBadge() {
  const p=state.requests.filter(r=>r.status==='pending').length;
  const b=document.getElementById('req-badge');
  if(b){b.style.display=p>0?'':'none';b.textContent=p;}
}
function timeSince(ts) {
  const d=Date.now()-ts;
  if(d<60000) return 'just now';
  if(d<3600000) return Math.floor(d/60000)+'m ago';
  if(d<86400000) return Math.floor(d/3600000)+'h ago';
  return Math.floor(d/86400000)+'d ago';
}
let toastTimer;
function toast(msg,type='ok') {
  const el=document.getElementById('toast');
  el.innerHTML=`<span>${{ok:'✓',err:'✕',warn:'⚡'}[type]||''}</span> ${msg}`;
  el.className=`msg-bar show ${type}`;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}
function parseCSVLine(line) {
  const r=[];let c='',q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}
    else c+=ch;
  }
  r.push(c); return r;
}

function renderPage(p){nav(p);}
buildDatalist();

// 1. override DB.save (global safety)
const _originalSave = DB.save;

DB.save = function() {
  _originalSave.apply(DB, arguments);

  try {
    if (typeof syncEnabled === 'function' && syncEnabled()) {
      syncPush();
    }
  } catch (e) {
    console.warn('Sync push failed:', e);
  }
};

let __isSyncing = false;

function _commitAndSync() {
  if (__isSyncing) return;
  DB.save();
}

function syncPullWrapper() {
  __isSyncing = true;
  return syncPull().finally(() => {
    __isSyncing = false;
  });
}

function importStaffFromExcel(file) {
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Clear old data
    STAFF_INFO_DB.length = 0;

    rows.forEach(r => {
      const user = {
        username: (r.Username || '').trim(),
        name: (r.Name || '').trim(),
        gender: (r.Gender || '').trim(),
        dob: r['Date of birth'] || '',
        role: normalizeRole(r.Position),

        // ❗ No team in Excel → set default
        team: 'NA',

        // 🔐 Enforced policy (ignore Excel values)
        password: '1234',
        mustChangePw: true
      };

      if (user.username) {
        STAFF_INFO_DB.push(user);
      }
    });

    ensureSystemAdmin();
    DB.save();

    toast('Staff imported successfully','ok');
    console.log('STAFF_INFO_DB:', STAFF_INFO_DB);
  };

  reader.readAsArrayBuffer(file);
}

function normalizeRole(pos) {
  if (!pos) return 'agent';

  pos = pos.toLowerCase();

  if (pos.includes('leader')) return 'leader';
  if (pos.includes('supervisor')) return 'supervisor';
  if (pos.includes('sr qa')) return 'sr_qa';
  if (pos.includes('qa')) return 'qa';

  return 'agent';
}

function parseMustChange(val) {
  if (val === true) return true;

  const v = String(val).toLowerCase();

  return v === 'true' || v === '1' || v.includes('✔');
}

function normalizeStaffPasswords() {
  STAFF_INFO_DB.forEach(u => {
    // Force default password if missing
    if (!u.password) {
      u.password = '1234';
    }

    // Force first-time change
    if (u.password === '1234') {
      u.mustChangePw = true;
    }

    // Ensure flag exists
    if (typeof u.mustChangePw !== 'boolean') {
      u.mustChangePw = true;
    }
  });
}

function ensureSystemAdmin() {
  const existing = STAFF_INFO_DB.find(u => u.username === DEFAULT_ADMIN.username);

  if (!existing) {
    // Add admin if missing
    STAFF_INFO_DB.push({ ...DEFAULT_ADMIN });
    return;
  }

  // 🔐 Enforce policy even if admin already exists
  if (!existing.password) {
    existing.password = '1234';
  }

  if (existing.password === '1234') {
    existing.mustChangePw = true;
  }

  if (typeof existing.mustChangePw !== 'boolean') {
    existing.mustChangePw = true;
  }
}

function isSystemAdmin(username) {
  return username === 'admin';
}

if (isSystemAdmin(user.username)) {
  toast('Cannot delete system admin','err');
  return;
}
// CALL THIS ON INIT
normalizeStaffPasswords();
ensureSystemAdmin();