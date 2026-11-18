// 원장님 휴대폰 알림용. 새 면담 글이 오면 알림을 띄우고, 누르면 보기 화면을 연다.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  e.waitUntil(self.registration.showNotification('서신어린이집 교사면담', {
    body: '새 면담 글이 도착했어요. 눌러서 확인해 보세요.',
    icon: '/images/teacher-talk-top.jpg',
    tag: 'seoshin-talk',
    renotify: true
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf('teacher-talk-view') > -1 && 'focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('/teacher-talk-view.html');
  }));
});
