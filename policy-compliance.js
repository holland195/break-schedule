// ═══════════════════════════════════════════════
//  POLICY COMPLIANCE v2 — Complete rewrite
//
//  All roles: 3 tabs in order:
//   1. Policy 2026   (General Policy, filter by year/quarter/month)
//   2. All Records   (formerly View & Filter, with Add Record button)
//   3. Summary 30D   (violations per role in last 30 days, with filters)
//
//  Admin: Import button in Policy 2026 tab pushes
//         full dataset directly to Firebase cloud.
//
//  Agent feedback: stored on record, synced via Firebase.
//
//  HOW TO INTEGRATE:
//   1. <script src="policy-compliance-v2.js"></script>  (before </body>)
//   2. Sidebar (all roles):
//      <div class="nav-item" onclick="nav('policy')" data-page="policy">
//        <span class="nav-ico">&#x1F4CB;</span> Policy Compliance
//        <span class="nav-badge" id="pc-badge" style="display:none">0</span>
//      </div>
//   3. nav.js pages object:  policy: renderPolicyCompliance,
//   4. updateBadge() in data.js:
//      if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
// ═══════════════════════════════════════════════

// ── Seed data from Policy compliance-2026 (153 real records) ──
const PC_SEED_DATA = [{"no":1,"date":"2026-01-02","leader":"hai.nguyen","empNo":"AGM0257","name":"Hồ Tấn Thành","role":"Agent","username":"thanh.ht","shift":"C","event":"3d","description":"Không mở Slack, không mở thông báo, không để trạng thái online trong giờ làm việc.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":2,"date":"2026-01-05","leader":"thuy.nguyenhong","empNo":"AGM0117","name":"Nguyễn Hữu Thiện","role":"QA","username":"thien.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":3,"date":"2026-01-05","leader":"tam.to","empNo":"AGM0226","name":"Nguyễn Hữu Thọ","role":"Agent","username":"tho.nh","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:39:24","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":4,"date":"2026-01-05","leader":"hai.nguyen","empNo":"AGM0150","name":"Nguyễn Thanh Thiện","role":"Agent","username":"thien.nguyenthanh","shift":"C","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:26","imageLink":"https://drive.google.com/file/d/1VynsgqCuvnCU6bRP9Wyk0xcEX25x7mWe/view?usp=drive_link","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":5,"date":"2026-01-06","leader":"thuy.nguyenhong","empNo":"AGF0089","name":"Nguyễn Ngọc Thương Thảo","role":"Sr Agent","username":"thao.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":6,"date":"2026-01-06","leader":"dung.tran","empNo":"AGM0147","name":"Trần Trọng Tuấn","role":"Agent","username":"tuan.tran","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":7,"date":"2026-01-06","leader":"tam.to","empNo":"AGF0097","name":"Nguyễn Đặng Ngọc Giàu","role":"Sr Agent","username":"giau.nguyen","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:05:13","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":8,"date":"2026-01-06","leader":"tran.le","empNo":"AGF0116","name":"Lê Nguyễn Huyền Trân","role":"Agent Supervisor","username":"tran.le","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:08:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":9,"date":"2026-01-06","leader":"tam.to","empNo":"AGF0097","name":"Nguyễn Đặng Ngọc Giàu","role":"Sr Agent","username":"giau.nguyen","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":10,"date":"2026-01-06","leader":"duy.huynh","empNo":"AGM0185","name":"Nguyễn Đình Nam","role":"Agent","username":"nam.nguyendinh","shift":"E","event":"3i","description":"Không tuân thủ hiệu lệnh của cấp trên.","duration":"","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":11,"date":"2026-01-07","leader":"tran.le","empNo":"AGM0058","name":"Đào Công Tấn Anh","role":"Sr QA","username":"anh.dao","shift":"A","event":"3a","description":"Đăng nhập, đăng xuất sai quy trình.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":12,"date":"2026-01-08","leader":"thanh.nguyen","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:09:31","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":13,"date":"2026-01-08","leader":"duy.huynh","empNo":"AGM0155","name":"Bùi Lập Duy","role":"Agent","username":"duy.bui","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:04:32","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":14,"date":"2026-01-09","leader":"duy.huynh","empNo":"AGF0223","name":"Phan Thị Trúc Linh","role":"Agent","username":"linh.ptt","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:06:07","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":15,"date":"2026-01-09","leader":"duy.huynh","empNo":"AGM0155","name":"Bùi Lập Duy","role":"Agent","username":"duy.bui","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:03:51","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":16,"date":"2026-01-10","leader":"thuy.nguyenhong","empNo":"AGM0184","name":"Phan Thái Bảo","role":"Agent","username":"bao.phan","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":17,"date":"2026-01-10","leader":"thuy.nguyenhong","empNo":"AGM0180","name":"Nguyễn Thanh Phong","role":"Agent","username":"phong.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ em có gủi lại giấy bệnh hưởng BHXH lại qua mail ạ.","status":"To Be Reviewed","leaderConfirm":"Bạn đã update BHXH","mailCheck":false,"warningMailDate":""},{"no":18,"date":"2026-01-11","leader":"tran.le","empNo":"AGF0093","name":"Nhữ Thị Hiền","role":"QA","username":"hien.nhu","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:39","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":19,"date":"2026-01-12","leader":"duy.huynh","empNo":"AGM0184","name":"Phan Thái Bảo","role":"Agent","username":"bao.phan","shift":"D","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:29","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":20,"date":"2026-01-12","leader":"tam.to","empNo":"AGM0232","name":"Đỗ Lê Quốc Thành","role":"Agent","username":"thanh.dlq","shift":"A","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:03:42","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":21,"date":"2026-01-12","leader":"tran.le","empNo":"AGM0256","name":"Ninh Trọng Ngôn","role":"Agent","username":"ngon.nt","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:05:52","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":22,"date":"2026-01-13","leader":"thuy.nguyenhong","empNo":"AGF0089","name":"Nguyễn Ngọc Thương Thảo","role":"Sr Agent","username":"thao.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":23,"date":"2026-01-13","leader":"hai.nguyen","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":24,"date":"2026-01-13","leader":"duy.huynh","empNo":"AGF0144","name":"Nguyễn Thị Phương Anh","role":"Agent","username":"anh.nguyen","shift":"D","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:10","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":25,"date":"2026-01-15","leader":"thanh.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:07:59","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":26,"date":"2026-01-15","leader":"ngocanh.tran","empNo":"AGF0093","name":"Nhữ Thị Hiền","role":"QA","username":"hien.nhu","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":27,"date":"2026-01-15","leader":"ngocanh.tran","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":28,"date":"2026-01-15","leader":"ngocanh.tran","empNo":"AGF0211","name":"Nguyễn Thị Hồng Quế","role":"Agent","username":"que.nguyenthihong","shift":"B","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:10","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":29,"date":"2026-01-16","leader":"thuy.nguyenhong","empNo":"AGM0171","name":"Nguyễn Trần Khai Nguyên","role":"Agent","username":"nguyen.nguyentran","shift":"D","event":"2f","description":"Break lố giờ.","duration":"0:20:33","imageLink":"","agentFeedback":"done a","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":30,"date":"2026-01-16","leader":"ngocanh.tran","empNo":"AGF0253","name":"Nguyễn Thị Lụa","role":"Agent","username":"lua.nt","shift":"B","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:22","imageLink":"","agentFeedback":"done a","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":31,"date":"2026-01-17","leader":"thuy.nguyenhong","empNo":"AGF0167","name":"Lê Khả Nhi","role":"QA","username":"nhi.le","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ em có bổ sung giấy BHXH rồi ạ","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":32,"date":"2026-01-17","leader":"thuy.nguyenhong","empNo":"AGM0184","name":"Phan Thái Bảo","role":"Agent","username":"bao.phan","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":33,"date":"2026-01-18","leader":"tam.to","empNo":"AGM0256","name":"Ninh Trọng Ngôn","role":"Agent","username":"ngon.nt","shift":"B","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:29","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":34,"date":"2026-01-19","leader":"thanh.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:03:28","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":35,"date":"2026-01-19","leader":"hai.nguyen","empNo":"AGM0113","name":"Nguyễn Huy Hiền","role":"Sr QA","username":"huyhien.nguyen","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:24:15","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":36,"date":"2026-01-20","leader":"thanh.nguyen","empNo":"AGM0165","name":"Lê Huỳnh Minh Anh","role":"Agent","username":"anh.le","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:08","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":37,"date":"2026-01-17","leader":"hai.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"E","event":"3c","description":"Không cập nhật performance hàng ngày.","duration":"","imageLink":"","agentFeedback":"Done a","status":"Resolved","leaderConfirm":"- Không check file NoInpect theo time TT quy định","mailCheck":false,"warningMailDate":""},{"no":38,"date":"2026-01-21","leader":"tran.le","empNo":"AGF0069","name":"Võ Hoàng Gia Bảo","role":"Sr Agent","username":"bao.vo","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:20:36","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":39,"date":"2026-01-21","leader":"tran.le","empNo":"AGM0175","name":"Nguyễn Thành Quang","role":"Agent","username":"quang.nguyenthanh","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"1:18:59","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":40,"date":"2026-01-21","leader":"hoa.nguyen","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"C","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:08:18","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":41,"date":"2026-01-22","leader":"hai.nguyen","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":42,"date":"2026-01-22","leader":"tran.le","empNo":"AGM0256","name":"Ninh Trọng Ngôn","role":"Agent","username":"ngon.nt","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:05:07","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":43,"date":"2026-01-23","leader":"thanh.nguyen","empNo":"AGM0194","name":"Nhâm Bổn Tường","role":"Agent","username":"tuong.nhambon","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:22","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":44,"date":"2026-01-23","leader":"tran.le","empNo":"AGM0132","name":"Lê Hoàng Anh Tú","role":"QA","username":"tu.lehoang","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:03:19","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":45,"date":"2026-01-23","leader":"tran.le","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:03:34","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":46,"date":"2026-01-23","leader":"tran.le","empNo":"AGF0207","name":"Huỳnh Trần Uyển Nhi","role":"Agent","username":"nhi.huynhtranuyen","shift":"B","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:04:15","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":47,"date":"2026-01-25","leader":"duy.huynh","empNo":"AGM0187","name":"Cao Chí Hải","role":"Agent","username":"hai.cao","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":48,"date":"2026-01-26","leader":"hai.nguyen","empNo":"AGM0133","name":"Nguyễn Quốc Duy","role":"Agent","username":"duy.nguyenquoc","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:36:53","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":49,"date":"2026-01-27","leader":"thuy.nguyenhong","empNo":"AGM0150","name":"Nguyễn Thanh Thiện","role":"Agent","username":"thien.nguyenthanh","shift":"C","event":"2a","description":"Không làm đủ số giờ tối thiểu.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":50,"date":"2026-01-30","leader":"thanh.nguyen","empNo":"AGM0222","name":"Nguyễn Khánh Duy","role":"Agent","username":"duy.nk","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:19:28","imageLink":"","agentFeedback":"done a ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":51,"date":"2026-01-31","leader":"thuy.nguyenhong","empNo":"AGF0069","name":"Võ Hoàng Gia Bảo","role":"Sr Agent","username":"bao.vo","shift":"B","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Em bị trúng gió nên xin về nửa ca á chị ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":52,"date":"2026-02-02","leader":"thanh.nguyen","empNo":"AGM0113","name":"Nguyễn Huy Hiền","role":"Sr QA","username":"huyhien.nguyen","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"1:00:40","imageLink":"","agentFeedback":"done a ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-02-03"},{"no":53,"date":"2026-02-03","leader":"tam.to","empNo":"AGF0089","name":"Nguyễn Ngọc Thương Thảo","role":"Sr Agent","username":"thao.nguyen","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:06:35","imageLink":"","agentFeedback":"done a ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":54,"date":"2026-02-04","leader":"thuy.nguyenhong","empNo":"AGF0144","name":"Nguyễn Thị Phương Anh","role":"Agent","username":"anh.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:07:02","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":55,"date":"2026-02-04","leader":"thuy.nguyenhong","empNo":"AGF0120","name":"Nguyễn Lê Như Ý","role":"QA","username":"y.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:55:41","imageLink":"","agentFeedback":"Done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":56,"date":"2026-02-04","leader":"hoa.nguyen","empNo":"AGM0072","name":"Nguyễn Đức Hòa","role":"Agent Supervisor","username":"hoa.nguyen","shift":"C","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:43:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":57,"date":"2026-02-04","leader":"duy.huynh","empNo":"AGM0205","name":"Trương Tấn Thành Trung Hiếu","role":"Agent","username":"hieu.truong","shift":"D","event":"2f","description":"Break lố giờ.","duration":"0:24:01","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":58,"date":"2026-02-05","leader":"duy.huynh","empNo":"AGF0182","name":"Phan Thị Phương Thảo","role":"Agent","username":"thao.phan","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":59,"date":"2026-02-05","leader":"thanh.nguyen","empNo":"AGM0138","name":"Bùi Nhật Anh","role":"QA","username":"anh.bui","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:27:24","imageLink":"","agentFeedback":"done a.","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":60,"date":"2026-02-05","leader":"thuy.nguyenhong","empNo":"AGM0174","name":"Nguyễn Thành Nhân","role":"Agent","username":"nhan.nguyenthanh","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:14:47","imageLink":"","agentFeedback":"done a.","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":61,"date":"2026-02-05","leader":"ngocanh.tran","empNo":"AGM0198","name":"Phan Trung Phong","role":"Agent","username":"phong.phan trung","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done a.","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":62,"date":"2026-02-06","leader":"tran.le","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:25","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":63,"date":"2026-02-06","leader":"tran.le","empNo":"AGM0174","name":"Nguyễn Thành Nhân","role":"Agent","username":"nhan.nguyenthanh","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:22","imageLink":"","agentFeedback":"done a.","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":64,"date":"2026-02-06","leader":"tran.le","empNo":"AGM0180","name":"Nguyễn Thanh Phong","role":"Agent","username":"phong.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:09:33","imageLink":"","agentFeedback":"done a.","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":65,"date":"2026-02-06","leader":"thuy.nguyenhong","empNo":"AGM0171","name":"Nguyễn Trần Khai Nguyên","role":"Agent","username":"nguyen.nguyentran","shift":"B","event":"2a","description":"Không làm đủ số giờ tối thiểu.","duration":"0:20:00","imageLink":"Nguyen.png","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":66,"date":"2026-02-08","leader":"duy.huynh","empNo":"AGM0179","name":"Trần Gia Huy","role":"Agent","username":"huy.tran","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"em có bổ sung giấy nghỉ BHYT rồi ạ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":67,"date":"2026-02-09","leader":"hoa.nguyen","empNo":"AGM0213","name":"Nguyễn Hoàng Phú","role":"Agent","username":"phu.nguyenhoang","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:07:00","imageLink":"","agentFeedback":"dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":68,"date":"2026-02-09","leader":"hai.nguyen","empNo":"AGM0198","name":"Phan Trung Phong","role":"Agent","username":"phong.phan trung","shift":"B","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":69,"date":"2026-02-09","leader":"tam.to","empNo":"AGF0168","name":"Huỳnh Thị Thanh Huyền","role":"Agent","username":"huyen.huynh","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":70,"date":"2026-02-11","leader":"dung.tran","empNo":"AGF0085","name":"Trần Thị Phương Trang","role":"QA","username":"trang.tran","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"dạ em có bổ sung giấy nghỉ BHXH rồi ạ","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":71,"date":"2026-02-11","leader":"hai.nguyen","empNo":"AGM0171","name":"Nguyễn Trần Khai Nguyên","role":"Agent","username":"nguyen.nguyentran","shift":"B","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":72,"date":"2026-02-13","leader":"hai.nguyen","empNo":"AGF0144","name":"Nguyễn Thị Phương Anh","role":"Agent","username":"anh.nguyen","shift":"B","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":73,"date":"2026-02-14","leader":"anh.tran","empNo":"AGM0102","name":"Trần Thanh Hà","role":"Sr Agent","username":"thanhha.tran","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":74,"date":"2026-02-20","leader":"hai.nguyen","empNo":"AGM0179","name":"Trần Gia Huy","role":"Agent","username":"huy.tran","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done a","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":75,"date":"2026-02-23","leader":"thanh.nguyen","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":76,"date":"2026-02-23","leader":"thanh.nguyen","empNo":"AGF0168","name":"Huỳnh Thị Thanh Huyền","role":"Agent","username":"huyen.huynh","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":77,"date":"2026-02-24","leader":"tam.to","empNo":"AGM0136","name":"Nguyễn Hoàng Duy Khang","role":"QA","username":"khang.nguyen","shift":"D","event":"2f","description":"Break lố giờ.","duration":"0:09:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":78,"date":"2026-02-24","leader":"ngocanh.tran","empNo":"AGM0147","name":"Trần Trọng Tuấn","role":"Agent","username":"tuan.tran","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":79,"date":"2026-02-25","leader":"thanh.nguyen","empNo":"AGM0102","name":"Trần Thanh Hà","role":"Sr Agent","username":"thanhha.tran","shift":"D","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:03:35","imageLink":"","agentFeedback":"a lên sớm r mà ko có máy log in đợi máy ca A về mới log đc","status":"To Be Reviewed","leaderConfirm":"ca A về 12h nên ca D hơi thiếu máy","mailCheck":false,"warningMailDate":""},{"no":80,"date":"2026-02-26","leader":"hai.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"B","event":"3c","description":"Không cập nhật performance hàng ngày.","duration":"","imageLink":"","agentFeedback":"Done a","status":"Resolved","leaderConfirm":"- Không check file NoInpect theo time TT quy định","mailCheck":false,"warningMailDate":""},{"no":81,"date":"2026-03-01","leader":"hoa.nguyen","empNo":"AGM0118","name":"Nguyễn Trung Kiên","role":"Agent","username":"kien.nguyen","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:50:52","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":82,"date":"2026-03-01","leader":"tran.le","empNo":"AGF0142","name":"Hồ Thị Hải Yến","role":"QA","username":"yen.ho","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":83,"date":"2026-03-02","leader":"hai.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-04-27"},{"no":84,"date":"2026-03-03","leader":"tran.le","empNo":"AGF0069","name":"Võ Hoàng Gia Bảo","role":"Sr Agent","username":"bao.vo","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Em có bổ sung giấy BHXH rồi ạ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":85,"date":"2026-03-05","leader":"tran.le","empNo":"AGF0196","name":"Ngô Diễm Thùy","role":"Agent","username":"thuy.ngodiem","shift":"E","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:03:13","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":86,"date":"2026-03-05","leader":"hai.nguyen","empNo":"AGM0155","name":"Bùi Lập Duy","role":"Agent","username":"duy.bui","shift":"B","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:33","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":87,"date":"2026-03-05","leader":"thuy.nguyenhong","empNo":"AGF0093","name":"Nhữ Thị Hiền","role":"QA","username":"hien.nhu","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":88,"date":"2026-03-07","leader":"thuy.nguyenhong","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"C","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:06:21","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":89,"date":"2026-03-10","leader":"thuy.nguyenhong","empNo":"AGF0040","name":"Trần Hà Phương Uyên","role":"Agent","username":"uyen.tran","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":90,"date":"2026-03-12","leader":"hai.nguyen","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":91,"date":"2026-03-13","leader":"ngocanh.tran","empNo":"AGM0225","name":"Hồ Trọng Thiện","role":"Agent","username":"thien.ht","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:11:04","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":92,"date":"2026-03-13","leader":"ngocanh.tran","empNo":"AGM0155","name":"Bùi Lập Duy","role":"Agent","username":"duy.bui","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":93,"date":"2026-03-13","leader":"thanh.nguyen","empNo":"AGM0149","name":"Nguyễn Huỳnh Quốc Duy","role":"QA","username":"duy.nguyenhuynhquoc","shift":"C","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"1:20:47","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":94,"date":"2026-03-13","leader":"thanh.nguyen","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":95,"date":"2026-03-16","leader":"tran.le","empNo":"AGM0117","name":"Nguyễn Hữu Thiện","role":"QA","username":"thien.nguyen","shift":"D","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:31:49","imageLink":"","agentFeedback":"Dạ Done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":96,"date":"2026-03-15","leader":"thuy.nguyenhong","empNo":"AGM0210","name":"Trần Tuấn Anh","role":"QA","username":"anh.trantuan","shift":"C","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":97,"date":"2026-03-16","leader":"duy.huynh","empNo":"AGM0131","name":"Hồ Tấn Phúc","role":"QA","username":"phuc.ho","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":98,"date":"2026-03-17","leader":"hai.nguyen","empNo":"AGM0147","name":"Trần Trọng Tuấn","role":"Agent","username":"tuan.tran","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Em bổ sung giấy BHXH rồi a","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":99,"date":"2026-03-17","leader":"dung.tran","empNo":"AGM0140","name":"Vũ Trung Kiên","role":"QA","username":"kien.vu","shift":"B","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Em đã bổ sung giấy BHXH rồi ạ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":100,"date":"2026-03-18","leader":"tam.to","empNo":"AGF0161","name":"Nguyễn Huỳnh Ý Như","role":"Agent","username":"nhu.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":101,"date":"2026-03-19","leader":"cuong.pham","empNo":"AGM0141","name":"Nguyễn Anh Vũ","role":"QA","username":"vu.nguyen","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:09:08","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":102,"date":"2026-03-19","leader":"ngocanh.tran","empNo":"AGM0131","name":"Hồ Tấn Phúc","role":"QA","username":"phuc.ho","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:50","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":103,"date":"2026-03-21","leader":"tam.to","empNo":"AGM0096","name":"Võ Tấn Nam","role":"QA","username":"nam.vo","shift":"D","event":"2f","description":"Break lố giờ.","duration":"0:16:09","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":104,"date":"2026-03-22","leader":"tran.le","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":105,"date":"2026-03-22","leader":"tran.le","empNo":"AGF0144","name":"Nguyễn Thị Phương Anh","role":"Agent","username":"anh.nguyen","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":106,"date":"2026-03-22","leader":"tran.le","empNo":"AGF0089","name":"Nguyễn Ngọc Thương Thảo","role":"Sr Agent","username":"thao.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":107,"date":"2026-03-24","leader":"hoa.nguyen","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:03:00","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":108,"date":"2026-03-24","leader":"dung.tran","empNo":"AGM0102","name":"Trần Thanh Hà","role":"Sr Agent","username":"thanhha.tran","shift":"C","event":"2a","description":"Không làm đủ số giờ tối thiểu.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"-45'","mailCheck":false,"warningMailDate":""},{"no":109,"date":"2026-03-28","leader":"thuy.nguyenhong","empNo":"AGM0173","name":"Nguyễn Lâm Bảo Ngọc","role":"QA","username":"ngoc.nguyen","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":110,"date":"2026-03-28","leader":"tran.le","empNo":"AGM0036","name":"Nguyễn Hữu Thịnh","role":"Sr QA","username":"thinh.nguyen","shift":"D","event":"3a","description":"Đăng nhập, đăng xuất sai quy trình.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":111,"date":"2026-03-30","leader":"ngocanh.tran","empNo":"AGM0179","name":"Trần Gia Huy","role":"Agent","username":"huy.tran","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":112,"date":"2026-03-31","leader":"hoa.nguyen","empNo":"AGM0072","name":"Nguyễn Đức Hòa","role":"Agent Supervisor","username":"hoa.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":113,"date":"2026-04-01","leader":"ngocanh.tran","empNo":"AGM0225","name":"Hồ Trọng Thiện","role":"Agent","username":"thien.ht","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"1:34:07","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":114,"date":"2026-04-01","leader":"tam.to","empNo":"AGM0138","name":"Bùi Nhật Anh","role":"QA","username":"anh.bui","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:32:33","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":115,"date":"2026-04-01","leader":"tam.to","empNo":"AGM0072","name":"Nguyễn Đức Hòa","role":"Agent Supervisor","username":"hoa.nguyen","shift":"B","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:04:54","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":116,"date":"2026-04-03","leader":"ngocanh.tran","empNo":"AGM0185","name":"Nguyễn Đình Nam","role":"Agent","username":"nam.nguyendinh","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"1:23:40","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":117,"date":"2026-04-05","leader":"hai.nguyen","empNo":"AGM0134","name":"Nguyễn Thành Nam","role":"Agent","username":"nam.nguyenthanh","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":118,"date":"2026-04-05","leader":"tam.to","empNo":"AGF0142","name":"Hồ Thị Hải Yến","role":"QA","username":"yen.ho","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":119,"date":"2026-04-05","leader":"tam.to","empNo":"AGF0097","name":"Nguyễn Đặng Ngọc Giàu","role":"Sr Agent","username":"giau.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Có nộp giấy bệnh","mailCheck":false,"warningMailDate":""},{"no":120,"date":"2026-04-05","leader":"tran.le","empNo":"AGM0231","name":"Nguyễn Bảo Thái Tú","role":"Agent","username":"tu.nbt","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":121,"date":"2026-04-05","leader":"tran.le","empNo":"AGM0133","name":"Nguyễn Quốc Duy","role":"Agent","username":"duy.nguyenquoc","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:50:36","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":122,"date":"2026-04-06","leader":"hoa.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"00:02:33","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-04-27"},{"no":123,"date":"2026-04-06","leader":"dung.tran","empNo":"AGF0182","name":"Phan Thị Phương Thảo","role":"Agent","username":"thao.phan","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":124,"date":"2026-04-08","leader":"tam.to","empNo":"AGM0113","name":"Nguyễn Huy Hiền","role":"Sr QA","username":"huyhien.nguyen","shift":"E","event":"2e","description":"Break sai khung giờ được sắp xếp.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":125,"date":"2026-04-08","leader":"thanh.nguyen","empNo":"AGM0175","name":"Nguyễn Thành Quang","role":"Agent","username":"quang.nguyenthanh","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":126,"date":"2026-04-07","leader":"thuy.nguyenhong","empNo":"AGM0102","name":"Trần Thanh Hà","role":"Sr Agent","username":"thanhha.tran","shift":"A","event":"2a","description":"Không làm đủ số giờ tối thiểu.","duration":"00:33:00","imageLink":"image (1).png","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":127,"date":"2026-04-09","leader":"thanh.nguyen","empNo":"AGM0149","name":"Nguyễn Huỳnh Quốc Duy","role":"QA","username":"duy.nguyenhuynhquoc","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":128,"date":"2026-04-10","leader":"tam.to","empNo":"AGF0089","name":"Nguyễn Ngọc Thương Thảo","role":"Sr Agent","username":"thao.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":129,"date":"2026-04-10","leader":"hoa.nguyen","empNo":"AGM0188","name":"Phan Xuân Thịnh","role":"QA","username":"thinh.phanxuan","shift":"D","event":"2a","description":"Không làm đủ số giờ tối thiểu.","duration":"0:10:00","imageLink":"","agentFeedback":"dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":130,"date":"2026-04-12","leader":"tran.le","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":131,"date":"2026-04-14","leader":"tran.le","empNo":"AGF0144","name":"Nguyễn Thị Phương Anh","role":"Agent","username":"anh.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":132,"date":"2026-04-14","leader":"tam.to","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:12","imageLink":"","agentFeedback":"dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-04-27"},{"no":133,"date":"2026-04-13","leader":"thanh.nguyen","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":134,"date":"2026-04-16","leader":"thuy.nguyenhong","empNo":"AGF0093","name":"Nhữ Thị Hiền","role":"QA","username":"hien.nhu","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"done","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":135,"date":"2026-04-16","leader":"thuy.nguyenhong","empNo":"AGM0140","name":"Vũ Trung Kiên","role":"QA","username":"kien.vu","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":136,"date":"2026-04-18","leader":"tam.to","empNo":"AGM0043","name":"Tô Hoài Tâm","role":"Agent Leader","username":"tam.to","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:11:03","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":137,"date":"2026-04-19","leader":"thuy.nguyenhong","empNo":"AGM0190","name":"Nguyễn Mai Việt Tính","role":"Agent","username":"tinh.nguyenmaiviet","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":138,"date":"2026-04-20","leader":"tran.le","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"E","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:06:01","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":139,"date":"2026-04-21","leader":"tam.to","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:06:18","imageLink":"","agentFeedback":"Dạ done ạ ","status":"Resolved","leaderConfirm":"","mailCheck":true,"warningMailDate":"2026-04-27"},{"no":140,"date":"2026-04-21","leader":"thanh.nguyen","empNo":"AGM0200","name":"Phạm Công Danh","role":"Agent","username":"danh.phamcong","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:58:42","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":141,"date":"2026-04-19","leader":"duy.huynh","empNo":"AGM0191","name":"Nguyễn Đinh Lưu","role":"Agent","username":"luu.nguyendinh","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":142,"date":"2026-04-12","leader":"thanh.nguyen","empNo":"AGM0213","name":"Nguyễn Hoàng Phú","role":"Agent","username":"phu.nguyenhoang","shift":"A","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:02:32","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":143,"date":"2026-04-23","leader":"dung.tran","empNo":"AGF0223","name":"Phan Thị Trúc Linh","role":"Agent","username":"linh.ptt","shift":"D","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"Dạ em có bổ sung giấy nghỉ BHXH rồi ạ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":144,"date":"2026-04-24","leader":"thanh.nguyen","empNo":"AGM0124","name":"Lê Công Triết","role":"Agent","username":"triet.le","shift":"A","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:03:54","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":145,"date":"2026-04-24","leader":"duy.huynh","empNo":"AGM0155","name":"Bùi Lập Duy","role":"Agent","username":"duy.bui","shift":"D","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"00:03:30","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":146,"date":"2026-04-27","leader":"duy.huynh","empNo":"AGM0212","name":"Võ Tuấn Vĩ","role":"Agent","username":"vi.votuan","shift":"D","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:24:33","imageLink":"","agentFeedback":"Dạ done ạ","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":147,"date":"2026-04-27","leader":"hai.nguyen","empNo":"AGF0168","name":"Huỳnh Thị Thanh Huyền","role":"Agent","username":"huyen.huynh","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":148,"date":"2026-04-28","leader":"hai.nguyen","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:05:26","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":149,"date":"2026-04-29","leader":"hai.nguyen","empNo":"AGF0107","name":"Nguyễn Thị Kim Chi","role":"Sr Agent","username":"chi.nguyen","shift":"E","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":150,"date":"2026-04-29","leader":"hai.nguyen","empNo":"AGF0078","name":"Lê Thị Quỳnh Như","role":"QA","username":"nhu.le","shift":"E","event":"2b","description":"Đăng nhập không đúng giờ.","duration":"0:02:22","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"","mailCheck":false,"warningMailDate":""},{"no":151,"date":"2026-04-29","leader":"tam.to","empNo":"AGF0069","name":"Võ Hoàng Gia Bảo","role":"Sr Agent","username":"bao.vo","shift":"A","event":"1b","description":"Không thông báo về việc nghỉ phép đúng thời gian quy định.","duration":"","imageLink":"","agentFeedback":"","status":"To Be Reviewed","leaderConfirm":"Đã bổ sung BHXH","mailCheck":false,"warningMailDate":""},{"no":152,"date":"2026-04-30","leader":"tam.to","empNo":"AGF0161","name":"Nguyễn Huỳnh Ý Như","role":"Agent","username":"nhu.nguyen","shift":"A","event":"3e","description":"Không cập nhật, không thả icon ở mỗi thông báo trên Slack.","duration":"","imageLink":"","agentFeedback":"","status":"Resolved","leaderConfirm":"Không đọc thông báo, tài liệu flow Redecode","mailCheck":false,"warningMailDate":""},{"no":153,"date":"2026-05-02","leader":"hai.nguyen","empNo":"AGM0136","name":"Nguyễn Hoàng Duy Khang","role":"QA","username":"khang.nguyen","shift":"E","event":"1d","description":"Đi trễ hoặc về sớm không đúng thời gian quy định.","duration":"0:35:10","imageLink":"","agentFeedback":"Dạ done ạ","status":"To Be Reviewed","leaderConfirm":"","mailCheck":false,"warningMailDate":""}];

const PC_EVENTS = {
  '1b':'Leave notice — not reported on time',
  '1d':'Late arrival / early departure',
  '2a':'Insufficient PAVE hours',
  '2b':'Late login to PAVE',
  '2e':'Break at wrong time slot',
  '2f':'Break duration exceeded',
  '3a':'Wrong PAVE login/logout steps',
  '3c':'Performance not updated',
  '3d':'Slack offline during shift',
  '3e':'Slack notification missed',
  '3i':'Disobedience',
};

// ── Page state ──
let _pcTab    = 'policy'; // 'policy' | 'records' | 'summary'
let _pcPage   = 1;
const _PC_PER = 25;

// Policy tab filters
let _pcPolYear = '2026';
let _pcPolQ    = '';   // '' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
let _pcPolMon  = '';   // '' | '2026-01' etc

// Records tab filters
let _pcRF = {dateFrom:'',dateTo:'',status:'',role:'',shift:'',event:'',leader:'',search:''};
let _pcFiltered = [];

// Summary 30D filters
let _pcS30Role   = '';
let _pcS30Event  = '';
let _pcS30Leader = '';

// ── Data ──
function _pcInit() {
  if (!state.policyCompliance || state.policyCompliance.length === 0) {
    state.policyCompliance = PC_SEED_DATA.map(function(r){ return Object.assign({},r); });
    save();
  }
}
function _pcData() { _pcInit(); return state.policyCompliance; }

function _pcApplyFilters() {
  var f = _pcRF;
  _pcFiltered = _pcData().filter(function(r) {
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo   && r.date > f.dateTo)   return false;
    if (f.status   && r.status !== f.status) return false;
    if (f.role     && r.role   !== f.role)   return false;
    if (f.shift    && r.shift  !== f.shift)  return false;
    if (f.event    && r.event  !== f.event)  return false;
    if (f.leader   && r.leader !== f.leader) return false;
    if (f.search) {
      var q = f.search.toLowerCase();
      if (!(r.name||'').toLowerCase().includes(q) &&
          !(r.empNo||'').toLowerCase().includes(q) &&
          !(r.username||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  _pcPage = 1;
}

// ── Helpers ──
function _pcStatusBadge(s) {
  return s === 'Resolved'
    ? '<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(74,222,128,.12);color:var(--ok);border:1px solid rgba(74,222,128,.3);font-weight:600;">Resolved</span>'
    : '<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(251,191,36,.12);color:var(--warn);border:1px solid rgba(251,191,36,.3);font-weight:600;">To Review</span>';
}

function _pcHeat(n) {
  if (!n) return 'color:var(--text3)';
  if (n<=2) return 'color:var(--accent);font-weight:600';
  if (n<=5) return 'color:var(--warn);font-weight:600';
  return 'color:var(--err);font-weight:700';
}

function _pcToday() {
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function _pcCutoff30() {
  var d=new Date(); d.setDate(d.getDate()-30);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function _pcUpdateBadge() {
  var n = _pcData().filter(function(r){
    return r.agentFeedback && !r.feedbackReadByLeader;
  }).length;
  var el = document.getElementById('pc-badge');
  if (el) { el.textContent=n; el.style.display=n>0?'':'none'; }
}

// ════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════
function renderPolicyCompliance() {
  _pcInit();
  var isAdm = isAdmin(currentUser);
  var isLdr = isLeader(currentUser);

  var T = function(id, ico, lbl) {
    var on = _pcTab === id;
    return '<button onclick="_pcTab=\''+id+'\';_pcPage=1;nav(\'policy\')" style="padding:9px 20px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;white-space:nowrap;transition:all .12s;color:'+(on?'var(--accent)':'var(--text3)')+';border-bottom:3px solid '+(on?'var(--accent)':'transparent')+';margin-bottom:-2px;">'+ico+' '+lbl+'</button>';
  };

  var tabs = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto;">'
    + T('policy', '&#x1F4CA;', 'Policy 2026')
    + T('records','&#x1F4CB;', 'All Records')
    + T('summary','&#x1F4C5;', 'Summary 30D')
    + '</div>';

  var content = '';
  if      (_pcTab==='policy')  content = _pcRenderPolicy();
  else if (_pcTab==='records') content = _pcRenderRecords();
  else if (_pcTab==='summary') content = _pcRenderSummary();

  return '<div class="page-header"><div>'
    + '<div class="page-title">&#x1F4CB; Policy Compliance</div>'
    + '<div class="page-sub">'+_pcData().length+' records &nbsp;&middot;&nbsp; Jan – May 2026</div>'
    + '</div></div>'
    + tabs
    + '<div id="pc-content">'+content+'</div>'
    + _pcEditModalHTML();
}

// ════════════════════════════════════════════
//  TAB 1: POLICY 2026
// ════════════════════════════════════════════
function _pcRenderPolicy() {
  var all  = _pcData();
  var ss   = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;';

  // ── Filter panel ──
  var years   = ['2026'];
  var quarters= ['Q1','Q2','Q3','Q4'];
  var months  = ['2026-01','2026-02','2026-03','2026-04','2026-05'];
  var mLabels = {'2026-01':'Jan 2026','2026-02':'Feb 2026','2026-03':'Mar 2026','2026-04':'Apr 2026','2026-05':'May 2026'};

  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Year</div>'
    + '<select style="'+ss+'" onchange="_pcPolYear=this.value;_pcPolQ=\'\';_pcPolMon=\'\';_pcRerender()">'
    + years.map(function(y){return '<option value="'+y+'"'+(y===_pcPolYear?' selected':'')+'>'+y+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Quarter</div>'
    + '<select style="'+ss+'" onchange="_pcPolQ=this.value;_pcPolMon=\'\';_pcRerender()">'
    + '<option value="">All quarters</option>'
    + quarters.map(function(q){return '<option value="'+q+'"'+(q===_pcPolQ?' selected':'')+'>'+q+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Month</div>'
    + '<select style="'+ss+'" onchange="_pcPolMon=this.value;_pcPolQ=\'\';_pcRerender()">'
    + '<option value="">All months</option>'
    + months.map(function(m){return '<option value="'+m+'"'+(m===_pcPolMon?' selected':'')+'>'+(mLabels[m]||m)+'</option>';}).join('')
    + '</select></div>'
    + '<button onclick="_pcPolYear=\'2026\';_pcPolQ=\'\';_pcPolMon=\'\';_pcRerender()" style="'+ss+'margin-top:13px;color:var(--text2);">Reset</button>';

  // Admin import button
  if (isAdmin(currentUser)) {
    filterBar += '<button onclick="_pcAdminImport()" class="btn btn-accent btn-sm" style="margin-top:13px;font-size:12px;">&#x2601; Push to Cloud</button>'
      + '<div id="pc-import-msg" style="font-size:11px;color:var(--text3);align-self:center;margin-top:13px;min-height:16px;"></div>';
  }
  filterBar += '</div>';

  // ── Filter records by year/Q/month ──
  function inScope(r) {
    if (!r.date) return false;
    if (_pcPolYear && !r.date.startsWith(_pcPolYear)) return false;
    if (_pcPolMon  && !r.date.startsWith(_pcPolMon))  return false;
    if (_pcPolQ) {
      var m = parseInt(r.date.split('-')[1]);
      var qmap = {Q1:[1,2,3],Q2:[4,5,6],Q3:[7,8,9],Q4:[10,11,12]};
      if (!qmap[_pcPolQ].includes(m)) return false;
    }
    return true;
  }

  var scoped = all.filter(inScope);
  var res    = scoped.filter(function(r){return r.status==='Resolved';}).length;
  var rev    = scoped.filter(function(r){return r.status==='To Be Reviewed';}).length;

  // ── Stats row ──
  var stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">'
    + '<div class="stat"><div class="stat-label">Violations</div><div class="stat-num" style="color:var(--accent);">'+scoped.length+'</div></div>'
    + '<div class="stat"><div class="stat-label">Resolved</div><div class="stat-num" style="color:var(--ok);">'+res+'</div></div>'
    + '<div class="stat"><div class="stat-label">To review</div><div class="stat-num" style="color:var(--warn);">'+rev+'</div></div>'
    + '<div class="stat"><div class="stat-label">Employees</div><div class="stat-num">'+[...new Set(scoped.map(function(r){return r.username;}))].length+'</div></div>'
    + '</div>';

  // ── Per-employee summary table ──
  var byEmp = {};
  scoped.forEach(function(r) {
    var k = r.username||r.name;
    if (!byEmp[k]) byEmp[k] = {name:r.name,empNo:r.empNo,role:r.role,username:r.username,leader:r.leader,
      total:0,events:{},months:{}};
    byEmp[k].total++;
    byEmp[k].events[r.event] = (byEmp[k].events[r.event]||0)+1;
    var mon = r.date.slice(0,7);
    byEmp[k].months[mon] = (byEmp[k].months[mon]||0)+1;
  });

  var empList = Object.values(byEmp).sort(function(a,b){return b.total-a.total;});

  // Month columns to show
  var shownMonths = _pcPolMon ? [_pcPolMon]
    : _pcPolQ ? months.filter(function(m){
        var mo=parseInt(m.split('-')[1]);
        var qmap={Q1:[1,2,3],Q2:[4,5,6],Q3:[7,8,9],Q4:[10,11,12]};
        return qmap[_pcPolQ].includes(mo);
      })
    : months;

  var thead = '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:50px;">#</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:70px;">EMP NO.</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:160px;">NAME</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">ROLE</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">LEADER</th>'
    + '<th style="padding:8px 10px;text-align:center;font-size:10px;color:var(--accent);font-family:\'IBM Plex Mono\',monospace;min-width:50px;">TOTAL</th>'
    + shownMonths.map(function(m){
        var lbl = (mLabels[m]||m).replace(' 2026','');
        return '<th style="padding:8px 6px;text-align:center;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:44px;">'+lbl+'</th>';
      }).join('')
    + '</tr></thead>';

  var rows = empList.map(function(e,i) {
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">'+(i+1)+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.empNo+'</td>'
      + '<td style="padding:7px 10px;font-weight:600;font-size:12px;">'+e.name+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;">'+e.role+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.leader+'</td>'
      + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:13px;'+_pcHeat(e.total)+'">'+e.total+'</td>'
      + shownMonths.map(function(m){
          var n = e.months[m]||0;
          return '<td style="padding:7px 6px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:12px;'+_pcHeat(n)+'">'+(n||'—')+'</td>';
        }).join('')
      + '</tr>';
  }).join('');

  var table = empList.length===0
    ? '<div class="empty"><div class="empty-ico">&#x1F4CB;</div>No records for the selected period.</div>'
    : '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px;">'
      + thead + '<tbody>'+rows+'</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:6px;">Heat: <span style="color:var(--accent);font-weight:600;">1–2</span> &nbsp;&middot;&nbsp; <span style="color:var(--warn);font-weight:600;">3–5</span> &nbsp;&middot;&nbsp; <span style="color:var(--err);font-weight:700;">6+</span></div>';

  return filterBar + stats + table;
}

// Admin: push seed data to Firebase
async function _pcAdminImport() {
  var msg = document.getElementById('pc-import-msg');
  if (msg) msg.innerHTML = '<span style="color:var(--text3);">&#x23F3; Pushing to cloud...</span>';
  _pcInit();
  state._pcUpdatedAt = Date.now();
  save();
  var ok = false;
  if (typeof syncWrite === 'function') {
    try { await syncWrite(); ok = true; } catch(e) { ok = false; }
  }
  if (msg) msg.innerHTML = ok
    ? '<span style="color:var(--ok);">&#x2714; '+_pcData().length+' records pushed to cloud.</span>'
    : '<span style="color:var(--err);">&#x26A0; Push failed — check Cloud Sync.</span>';
}

// ════════════════════════════════════════════
//  TAB 2: ALL RECORDS
// ════════════════════════════════════════════
function _pcRenderRecords() {
  _pcApplyFilters();
  var all = _pcData();
  var res = all.filter(function(r){return r.status==='Resolved';}).length;
  var rev = all.filter(function(r){return r.status==='To Be Reviewed';}).length;
  var f   = _pcRF;
  var ss  = 'height:30px;padding:0 8px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';

  var leaders = [...new Set(all.map(function(r){return r.leader;}).filter(Boolean))].sort();

  var mkSel = function(fld, val, opts, ph) {
    return '<select style="'+ss+'" onchange="_pcRF.'+fld+'=this.value;_pcApplyFilters();_pcRerender()">'
      + '<option value="">'+ph+'</option>'
      + opts.map(function(o){
          var v=o.v||o, l=o.l||o;
          return '<option value="'+v+'"'+(v===val?' selected':'')+'>'+l+'</option>';
        }).join('')
      + '</select>';
  };

  var stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">'
    + '<div class="stat"><div class="stat-label">Total</div><div class="stat-num" style="color:var(--accent);">'+all.length+'</div></div>'
    + '<div class="stat"><div class="stat-label">Resolved</div><div class="stat-num" style="color:var(--ok);">'+res+'</div></div>'
    + '<div class="stat"><div class="stat-label">To review</div><div class="stat-num" style="color:var(--warn);">'+rev+'</div></div>'
    + '<div class="stat"><div class="stat-label">Filtered</div><div class="stat-num">'+_pcFiltered.length+'</div></div>'
    + '</div>';

  var filterRow = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:12px;">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">From</div><input type="date" value="'+(f.dateFrom||'')+'" onchange="_pcRF.dateFrom=this.value;_pcApplyFilters();_pcRerender()" style="'+ss+'"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">To</div><input type="date" value="'+(f.dateTo||'')+'" onchange="_pcRF.dateTo=this.value;_pcApplyFilters();_pcRerender()" style="'+ss+'"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Status</div>'+mkSel('status',f.status,['Resolved','To Be Reviewed'],'All statuses')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Role</div>'+mkSel('role',f.role,['Agent','Agent Leader','Agent Supervisor','QA','Sr Agent','Sr QA'],'All roles')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Shift</div>'+mkSel('shift',f.shift,['A','B','C','D','E'],'All')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Event</div>'+mkSel('event',f.event,Object.keys(PC_EVENTS).map(function(k){return {v:k,l:k+' — '+PC_EVENTS[k].split('—')[0].trim()};}), 'All events')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Leader</div>'+mkSel('leader',f.leader,leaders,'All leaders')+'</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
    + '<input type="text" value="'+(f.search||'')+'" placeholder="Search name / emp no / username..." oninput="_pcRF.search=this.value;_pcApplyFilters();_pcRerender()" style="'+ss+'width:250px;">'
    + '<button onclick="_pcRF={dateFrom:\'\',dateTo:\'\',status:\'\',role:\'\',shift:\'\',event:\'\',leader:\'\',search:\'\'};_pcApplyFilters();_pcRerender()" style="'+ss+'color:var(--text2);">Reset</button>'
    + '<button onclick="_pcOpenAddModal()" class="btn btn-accent btn-sm" style="margin-left:auto;font-size:12px;padding:5px 14px;">+ Add Record</button>'
    + '</div></div>';

  var start = (_pcPage-1)*_PC_PER;
  var slice = _pcFiltered.slice(start, start+_PC_PER);
  var totalPages = Math.max(1, Math.ceil(_pcFiltered.length/_PC_PER));

  var rows = slice.length===0
    ? '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">No matching records.</td></tr>'
    : slice.map(function(r,i) {
        var idx = _pcData().indexOf(r);
        return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="_pcOpenEditModal('+idx+')">'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+r.no+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;font-family:\'IBM Plex Mono\',monospace;">'+r.date+'</td>'
          + '<td style="padding:7px 10px;font-weight:600;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.name+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+r.empNo+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;">'+r.role+'</td>'
          + '<td style="padding:7px 10px;text-align:center;"><span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:4px;font-size:11px;font-weight:700;background:var(--bg4);color:var(--text2);">'+(r.shift||'—')+'</span></td>'
          + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-weight:700;font-size:12px;color:var(--accent);">'+r.event+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.leader+'</td>'
          + '<td style="padding:7px 10px;">'+_pcStatusBadge(r.status)+'</td>'
          + '<td style="padding:7px 10px;">'+(r.agentFeedback?'<span style="font-size:11px;color:var(--ok);">&#x1F4AC;</span>':'')+'</td>'
          + '</tr>';
      }).join('');

  var pager = '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:8px;">'
    + '<span style="font-size:11px;color:var(--text3);">Page '+_pcPage+'/'+totalPages+' ('+_pcFiltered.length+')</span>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.max(1,_pcPage-1);_pcRerender()" '+(_pcPage<=1?'disabled':'')+'>Prev</button>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.min('+totalPages+',_pcPage+1);_pcRerender()" '+(_pcPage>=totalPages?'disabled':'')+'>Next</button>'
    + '</div>';

  return stats + filterRow
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">'
    + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + ['#','DATE','NAME','EMP NO.','ROLE','SFT','EVENT','LEADER','STATUS','FB'].map(function(h){
        return '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+h+'</th>';
      }).join('')
    + '</tr></thead><tbody>'+rows+'</tbody></table></div>'
    + pager;
}

// ════════════════════════════════════════════
//  TAB 3: SUMMARY 30D
// ════════════════════════════════════════════
function _pcRenderSummary() {
  var cutoff = _pcCutoff30();
  var today  = _pcToday();
  var all    = _pcData();
  var base   = all.filter(function(r){ return r.date >= cutoff && r.date <= today; });

  var leaders = [...new Set(all.map(function(r){return r.leader;}).filter(Boolean))].sort();
  var ss = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;';

  // Apply filters
  var filtered = base.filter(function(r){
    if (_pcS30Role   && r.role   !== _pcS30Role)   return false;
    if (_pcS30Event  && r.event  !== _pcS30Event)  return false;
    if (_pcS30Leader && r.leader !== _pcS30Leader) return false;
    return true;
  });

  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
    + '<div style="font-size:12px;color:var(--text2);font-weight:500;align-self:center;">Last 30 days &nbsp;<span style="color:var(--text3);font-size:11px;">'+cutoff+' → '+today+'</span></div>'
    + '<div style="margin-left:8px;"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Role</div>'
    + '<select style="'+ss+'" onchange="_pcS30Role=this.value;_pcRerender()">'
    + '<option value="">All roles</option>'
    + ['Agent','Agent Leader','Agent Supervisor','QA','Sr Agent','Sr QA'].map(function(r){return '<option value="'+r+'"'+(_pcS30Role===r?' selected':'')+'>'+r+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Event</div>'
    + '<select style="'+ss+'" onchange="_pcS30Event=this.value;_pcRerender()">'
    + '<option value="">All events</option>'
    + Object.keys(PC_EVENTS).map(function(k){return '<option value="'+k+'"'+(_pcS30Event===k?' selected':'')+'>'+k+' — '+PC_EVENTS[k].split('—')[0].trim()+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Leader</div>'
    + '<select style="'+ss+'" onchange="_pcS30Leader=this.value;_pcRerender()">'
    + '<option value="">All leaders</option>'
    + leaders.map(function(l){return '<option value="'+l+'"'+(_pcS30Leader===l?' selected':'')+'>'+l+'</option>';}).join('')
    + '</select></div>'
    + '<button onclick="_pcS30Role=\'\';_pcS30Event=\'\';_pcS30Leader=\'\';_pcRerender()" style="'+ss+'color:var(--text2);margin-top:13px;">Reset</button>'
    + '<span style="font-size:11px;color:var(--text3);align-self:center;margin-top:13px;">'+filtered.length+' violations</span>'
    + '</div>';

  if (filtered.length===0) {
    return filterBar + '<div class="empty"><div class="empty-ico">&#x2705;</div>No violations in the last 30 days matching the selected filters.</div>';
  }

  // ── Stats cards ──
  var roles   = ['Agent','Sr Agent','QA','Sr QA','Agent Leader','Agent Supervisor'];
  var statRow = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px;">'
    + roles.map(function(role) {
        var n = filtered.filter(function(r){return r.role===role;}).length;
        return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center;">'
          + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-family:\'IBM Plex Mono\',monospace;">'+role.replace('Agent ','').replace('Sr ','Sr ')+'</div>'
          + '<div style="font-size:22px;font-weight:600;'+_pcHeat(n)+'">'+n+'</div>'
          + '</div>';
      }).join('')
    + '</div>';

  // ── Group by role → per-person table ──
  var byPerson = {};
  filtered.forEach(function(r) {
    var k = r.username||r.name;
    if (!byPerson[k]) byPerson[k]={name:r.name,empNo:r.empNo,role:r.role,username:r.username,leader:r.leader,records:[]};
    byPerson[k].records.push(r);
  });

  var eventKeys = [...new Set(filtered.map(function(r){return r.event;}))].sort();

  // Group persons by role
  var roleOrder = ['Agent','Sr Agent','QA','Sr QA','Agent Leader','Agent Supervisor'];
  var sections  = '';
  roleOrder.forEach(function(role) {
    var persons = Object.values(byPerson).filter(function(p){return p.role===role;});
    if (!persons.length) return;
    persons.sort(function(a,b){return b.records.length-a.records.length;});

    var ROLE_COLORS = {
      'Agent':'var(--accent)','Sr Agent':'var(--B-color)','QA':'var(--E-color)',
      'Sr QA':'var(--C-color)','Agent Leader':'var(--warn)','Agent Supervisor':'var(--A-color)'
    };
    var color = ROLE_COLORS[role]||'var(--text2)';

    var thead = '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">#</th>'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:130px;">NAME</th>'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">LEADER</th>'
      + '<th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--accent);font-family:\'IBM Plex Mono\',monospace;">TOTAL</th>'
      + eventKeys.map(function(ev){return '<th style="padding:7px 6px;text-align:center;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:36px;" title="'+PC_EVENTS[ev]+'">'+ev+'</th>';}).join('')
      + '</tr></thead>';

    var rows = persons.map(function(p,i) {
      var evCounts = {};
      p.records.forEach(function(r){ evCounts[r.event]=(evCounts[r.event]||0)+1; });
      return '<tr style="border-bottom:1px solid var(--border);">'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text3);">'+(i+1)+'</td>'
        + '<td style="padding:6px 10px;font-weight:600;font-size:12px;">'+p.name+'</td>'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+p.leader+'</td>'
        + '<td style="padding:6px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:13px;'+_pcHeat(p.records.length)+'">'+p.records.length+'</td>'
        + eventKeys.map(function(ev){
            var n=evCounts[ev]||0;
            return '<td style="padding:6px 6px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:12px;'+_pcHeat(n)+'">'+(n||'—')+'</td>';
          }).join('')
        + '</tr>';
    }).join('');

    sections += '<div style="margin-bottom:16px;">'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:'+color+';padding-bottom:6px;border-bottom:1px solid var(--border);">'
      + role+' <span style="font-size:11px;color:var(--text3);font-weight:400;">'+persons.length+' staff · '+persons.reduce(function(s,p){return s+p.records.length;},0)+' violations</span></div>'
      + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + thead + '<tbody>'+rows+'</tbody></table></div></div>';
  });

  // ── Event reference ──
  var ref = '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-top:4px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Event code reference</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:12px;">'
    + Object.entries(PC_EVENTS).map(function(e){return '<div><b style="font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">'+e[0]+'</b> — '+e[1]+'</div>';}).join('')
    + '</div></div>';

  return filterBar + statRow + sections + ref;
}

// ════════════════════════════════════════════
//  EDIT MODAL
// ════════════════════════════════════════════
function _pcEditModalHTML() {
  return '<div id="pc-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:22px;width:560px;max-width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<span style="font-size:15px;font-weight:600;" id="pc-modal-title">Record</span>'
    + '<button onclick="_pcCloseModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);line-height:1;">&#x2715;</button>'
    + '</div><div id="pc-modal-body"></div></div></div>';
}

function _pcCloseModal() {
  var el = document.getElementById('pc-modal');
  if (el) el.style.display = 'none';
}

function _pcOpenEditModal(idx) {
  var r   = _pcData()[idx];
  var ldr = isLeader(currentUser);
  var agentView = !ldr && r.username === currentUser.username;

  document.getElementById('pc-modal-title').textContent = 'Record #'+r.no+' — '+r.name;
  document.getElementById('pc-modal-body').innerHTML = ''
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12px;background:var(--bg3);border-radius:8px;padding:12px;">'
    + '<div><span style="color:var(--text3);">Date</span><br><b>'+r.date+'</b></div>'
    + '<div><span style="color:var(--text3);">Event</span><br><b style="font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">'+r.event+'</b> — '+PC_EVENTS[r.event]+'</div>'
    + '<div><span style="color:var(--text3);">Employee</span><br><b>'+r.name+'</b> · '+r.empNo+'</div>'
    + '<div><span style="color:var(--text3);">Role / Shift</span><br>'+r.role+' / Shift '+(r.shift||'—')+'</div>'
    + '<div><span style="color:var(--text3);">Leader</span><br>'+r.leader+'</div>'
    + '<div><span style="color:var(--text3);">Status</span><br>'+_pcStatusBadge(r.status)+'</div>'
    + '</div>'
    + (r.description ? '<div style="font-size:12px;background:var(--bg3);border-radius:6px;padding:10px;margin-bottom:12px;line-height:1.8;color:var(--text2);">'+r.description+'</div>' : '')
    + (r.duration    ? '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Duration: <b>'+r.duration+'</b></div>' : '')
    + (r.imageLink   ? '<div style="font-size:11px;margin-bottom:8px;"><a href="'+r.imageLink+'" target="_blank" style="color:var(--accent);">&#x1F517; View evidence</a></div>' : '')
    + (r.leaderConfirm ? '<div style="font-size:11px;background:rgba(31,102,241,.06);border:1px solid rgba(31,102,241,.15);border-radius:6px;padding:8px 12px;margin-bottom:12px;">Leader note: '+r.leaderConfirm+'</div>' : '')

    // Agent feedback section (visible to all)
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">&#x1F4AC; Agent Feedback</div>'
    + (r.agentFeedback
        ? '<div style="font-size:12px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:7px;padding:10px 12px;line-height:1.7;">'+r.agentFeedback+'</div>'
        : '<div style="font-size:12px;color:var(--text3);font-style:italic;">No feedback yet.</div>')
    + '</div>'

    // Leader edit section
    + (ldr ? '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:10px;">Leader edit</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + '<div class="fg"><label>Status</label><select id="pce-status"><option '+(r.status==='Resolved'?'selected':'')+'>Resolved</option><option '+(r.status==='To Be Reviewed'?'selected':'')+'>To Be Reviewed</option></select></div>'
      + '<div class="fg"><label>Mail check</label><select id="pce-mail"><option value="false" '+(!r.mailCheck?'selected':'')+'>No</option><option value="true" '+(r.mailCheck?'selected':'')+'>Yes</option></select></div>'
      + '</div>'
      + '<div class="fg" style="margin-bottom:12px;"><label>Leader confirm note</label><textarea id="pce-confirm" style="min-height:50px;">'+(r.leaderConfirm||'')+'</textarea></div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-accent" onclick="_pcSaveEdit('+idx+')">Save</button>'
      + '<button class="btn" onclick="_pcCloseModal()">Cancel</button>'
      + '</div><div id="pce-msg" style="font-size:11px;margin-top:6px;min-height:16px;"></div>'
      + '</div>' : '')
    ;

  document.getElementById('pc-modal').style.display = 'flex';
}

function _pcSaveEdit(idx) {
  var r = state.policyCompliance[idx];
  r.status        = document.getElementById('pce-status').value;
  r.leaderConfirm = document.getElementById('pce-confirm').value;
  r.mailCheck     = document.getElementById('pce-mail').value==='true';
  save();
  if (typeof syncWrite === 'function') syncWrite();
  var msg = document.getElementById('pce-msg');
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Saved</span>';
  setTimeout(_pcCloseModal, 600);
  _pcApplyFilters(); _pcRerender();
}

// ════════════════════════════════════════════
//  ADD RECORD MODAL (leader only)
// ════════════════════════════════════════════
function _pcOpenAddModal() {
  if (!isLeader(currentUser)) return;
  var today = _pcToday();
  var usernames = state.users.map(function(u){return u.username;}).filter(Boolean).sort();
  var SHIFT_TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};

  document.getElementById('pc-modal-title').textContent = 'Add Violation Record';
  document.getElementById('pc-modal-body').innerHTML = ''
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'

    // Username
    + '<div class="fg"><label>Username * <span style="font-size:10px;color:var(--text3);">(auto-fills below)</span></label>'
    + '<input type="text" id="pca-user" list="pca-user-list" placeholder="e.g. thien.nguyenthanh" oninput="_pcaAutoFill()" style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;">'
    + '<datalist id="pca-user-list">'+usernames.map(function(u){return '<option value="'+u+'">';}).join('')+'</datalist>'
    + '<div id="pca-status" style="font-size:11px;min-height:14px;margin-top:3px;"></div></div>'

    // Date
    + '<div class="fg"><label>Date *</label><input type="date" id="pca-date" value="'+today+'"></div>'

    // Shift (badge picker)
    + '<div class="fg"><label>Shift <span style="font-size:10px;color:var(--accent);background:rgba(31,102,241,.1);padding:1px 6px;border-radius:99px;margin-left:3px;">from schedule</span></label>'
    + '<div style="display:flex;gap:5px;margin-top:2px;" id="pca-shifts">'
    + ['A','B','C','D','E'].map(function(s){
        return '<span id="pca-sb-'+s+'" onclick="window._pcaShift=\''+s+'\';_pcaSelectShift(\''+s+'\');" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid transparent;background:var(--'+s+'-bg);color:var(--'+s+'-color);">'+s+'</span>';
      }).join('')
    + '</div>'
    + '<div id="pca-shift-note" style="font-size:11px;color:var(--text3);margin-top:3px;">—</div></div>'

    // Event
    + '<div class="fg"><label>Event *</label>'
    + '<select id="pca-event"><option value="">Select event</option>'
    + Object.keys(PC_EVENTS).map(function(k){return '<option value="'+k+'">'+k+' — '+PC_EVENTS[k]+'</option>';}).join('')
    + '</select></div>'

    // Duration + Image
    + '<div class="fg"><label>Duration <span style="font-size:10px;color:var(--text3);">optional</span></label><input type="text" id="pca-dur" placeholder="0:15:00"></div>'
    + '<div class="fg"><label>Image link <span style="font-size:10px;color:var(--text3);">optional</span></label><input type="url" id="pca-img" placeholder="https://drive.google.com/..."></div>'
    + '</div>'

    // Description
    + '<div class="fg" style="margin-bottom:10px;"><label>Description</label><textarea id="pca-desc" style="min-height:52px;"></textarea></div>'

    // Auto-filled row
    + '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Auto-retrieved <span style="color:var(--accent);font-size:9px;">read only</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px;">'
    + '<div><span style="color:var(--text3);font-size:11px;">Name</span><br><b id="pca-name" style="font-size:12px;">—</b></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Emp No.</span><br><span id="pca-empno" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;">—</span></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Role</span><br><span id="pca-role" style="font-size:11px;">—</span></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Leader</span><br><span id="pca-leader" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;">—</span></div>'
    + '</div></div>'

    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
    + '<div class="fg" style="margin:0;"><label>Status</label><select id="pca-status"><option>To Be Reviewed</option><option>Resolved</option></select></div>'
    + '<button class="btn btn-accent" onclick="_pcaSaveRecord()" style="margin-top:16px;">Save record</button>'
    + '<button class="btn" onclick="_pcCloseModal()" style="margin-top:16px;">Cancel</button>'
    + '</div>'
    + '<div id="pca-msg" style="font-size:11px;margin-top:8px;min-height:16px;"></div>';

  window._pcaShift = null;
  document.getElementById('pc-modal').style.display = 'flex';

  // Try to auto-detect shift for today
  setTimeout(function() {
    var u = state.users.find(function(u){return u.username===currentUser.username;});
    if (u && u.schedule) {
      var d = new Date();
      var dk = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      var sch = u.schedule[dk];
      if (sch && sch!=='0') _pcaSelectShift(sch.charAt(0));
    }
  }, 50);
}

// Leader→username map
var _PC_LEADER_MAP = {
  'thanh.ht':'hai.nguyen','thien.nguyen':'thuy.nguyenhong','tho.nh':'tam.to',
  'thien.nguyenthanh':'hai.nguyen','thao.nguyen':'thuy.nguyenhong','tuan.tran':'dung.tran',
  'giau.nguyen':'tam.to','tran.le':'tran.le','nam.nguyendinh':'duy.huynh',
  'nhu.le':'thanh.nguyen','duy.bui':'duy.huynh','tinh.nguyenmaiviet':'hai.nguyen',
  'anh.nguyen':'duy.huynh','triet.le':'thanh.nguyen','chi.nguyen':'hoa.nguyen',
  'y.nguyen':'thuy.nguyenhong','hoa.nguyen':'hoa.nguyen','anh.bui':'thanh.nguyen',
  'huy.tran':'duy.huynh','phu.nguyenhoang':'hoa.nguyen','huyen.huynh':'tam.to',
  'trang.tran':'dung.tran','khang.nguyen':'tam.to','kien.nguyen':'hoa.nguyen',
  'yen.ho':'tran.le','uyen.tran':'thuy.nguyenhong','duy.nguyenhuynhquoc':'thanh.nguyen',
  'anh.trantuan':'thuy.nguyenhong','phuc.ho':'duy.huynh','kien.vu':'dung.tran',
  'nhu.nguyen':'tam.to','vu.nguyen':'cuong.pham','nam.vo':'tam.to',
  'ngoc.nguyen':'thuy.nguyenhong','thinh.nguyen':'tran.le','nam.nguyenthanh':'hai.nguyen',
  'tu.nbt':'tran.le','thinh.phanxuan':'hoa.nguyen','tam.to':'tam.to',
  'danh.phamcong':'thanh.nguyen','luu.nguyendinh':'duy.huynh','vi.votuan':'duy.huynh',
  'khoa.le':'duy.huynh','long.nguyen':'tam.to','minhduy.tran':'thanh.nguyen',
  'tung.dang':'duy.huynh','hoang.nguyentuyen':'hoa.nguyen','linh.ptt':'duy.huynh',
  'bao.phan':'thuy.nguyenhong','phong.nguyen':'thuy.nguyenhong','hien.nhu':'tran.le',
  'nhi.le':'thuy.nguyenhong','huyhien.nguyen':'hai.nguyen','anh.le':'thanh.nguyen',
  'bao.vo':'tran.le','quang.nguyenthanh':'tran.le','duy.nguyenquoc':'hai.nguyen',
  'duy.nk':'thanh.nguyen','hai.cao':'duy.huynh','hieu.truong':'duy.huynh',
  'thao.phan':'duy.huynh','nhan.nguyenthanh':'thuy.nguyenhong','thuy.ngodiem':'tran.le',
  'thien.ht':'ngocanh.tran','anh.dao':'tran.le','nguyen.nguyentran':'thuy.nguyenhong',
  'lua.nt':'ngocanh.tran','que.nguyenthihong':'ngocanh.tran',
};

function _pcaAutoFill() {
  var val = (document.getElementById('pca-user').value||'').trim().toLowerCase();
  var st  = document.getElementById('pca-status-line')||document.getElementById('pca-status');
  var status = document.getElementById('pca-status');
  var pst    = document.getElementById('pca-status-line')||document.getElementById('pca-status');

  var setField = function(id, v) { var el=document.getElementById(id); if(el) el.textContent=v||'—'; };

  if (!val) { setField('pca-name','—'); setField('pca-empno','—'); setField('pca-role','—'); setField('pca-leader','—'); return; }

  var user = state.users.find(function(u){return u.username===val;});
  var si   = state.staffInfo&&state.staffInfo[val];

  if (user || si) {
    setField('pca-name',   (user&&user.name)   || (si&&si.name)   || val);
    setField('pca-empno',  (user&&user.empNo)   || (si&&si.empNo)  || '');
    setField('pca-role',   (user&&user.role)    || (si&&si.role)   || '');
    setField('pca-leader', _PC_LEADER_MAP[val]  || '');

    // Auto-fill shift from today's schedule
    if (user && user.schedule) {
      var d  = new Date();
      var dk = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      var sch = user.schedule[dk] || user.schedule[WEEK_DAYS[d.getDay()===0?6:d.getDay()-1]] || null;
      if (sch && sch!=='0' && 'ABCDE'.indexOf(sch.charAt(0))>=0) {
        _pcaSelectShift(sch.charAt(0));
        window._pcaShift = sch.charAt(0);
      }
    }
    var msg = document.getElementById('pca-status');
    // no-op: name displayed
  }
}

function _pcaSelectShift(s) {
  var TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};
  window._pcaShift = s;
  ['A','B','C','D','E'].forEach(function(x){
    var el=document.getElementById('pca-sb-'+x);
    if (el) el.style.border=(x===s)?'2px solid var(--'+s+'-color)':'2px solid transparent';
  });
  var note=document.getElementById('pca-shift-note');
  if (note) note.textContent='Shift '+s+' · '+(TIMES[s]||'');
}

function _pcaSaveRecord() {
  var user    = (document.getElementById('pca-user').value||'').trim();
  var event   = (document.getElementById('pca-event').value||'').trim();
  var msg     = document.getElementById('pca-msg');
  if (!user)  { if(msg) msg.innerHTML='<span style="color:var(--err);">Enter username.</span>'; return; }
  if (!event) { if(msg) msg.innerHTML='<span style="color:var(--err);">Select event.</span>'; return; }
  if (!window._pcaShift) { if(msg) msg.innerHTML='<span style="color:var(--err);">Select shift.</span>'; return; }

  var d  = _pcData();
  var no = d.reduce(function(m,r){return Math.max(m,r.no||0);},0)+1;
  var nameEl   = document.getElementById('pca-name');
  var empnoEl  = document.getElementById('pca-empno');
  var roleEl   = document.getElementById('pca-role');
  var leaderEl = document.getElementById('pca-leader');

  d.push({
    no: no,
    date:    document.getElementById('pca-date').value,
    leader:  leaderEl ? leaderEl.textContent.replace('—','') : '',
    empNo:   empnoEl  ? empnoEl.textContent.replace('—','')  : '',
    name:    nameEl   ? nameEl.textContent.replace('—','')   : user,
    role:    roleEl   ? roleEl.textContent.replace('—','')   : '',
    username: user,
    shift:   window._pcaShift,
    event:   event,
    description: (document.getElementById('pca-desc').value||'').trim(),
    duration:    (document.getElementById('pca-dur').value||'').trim(),
    imageLink:   (document.getElementById('pca-img').value||'').trim(),
    agentFeedback: '',
    status: document.getElementById('pca-status').value || 'To Be Reviewed',
    leaderConfirm:'', mailCheck:false, warningMailDate:'',
  });
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Record #'+no+' saved.</span>';
  setTimeout(function(){ _pcCloseModal(); _pcApplyFilters(); _pcRerender(); }, 700);
}

// ── Re-render helper ──
function _pcRerender() {
  var el = document.getElementById('pc-content');
  if (!el) { nav('policy'); return; }
  var c = '';
  if      (_pcTab==='policy')  c = _pcRenderPolicy();
  else if (_pcTab==='records') c = _pcRenderRecords();
  else if (_pcTab==='summary') c = _pcRenderSummary();
  el.innerHTML = c;
}