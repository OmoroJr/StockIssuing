// Background runner (Capacitor Background Runner plugin) - sends queued reports
// when the phone gets internet, even if the app is closed.
// The app hands over the pending reports with 'setPending'; the OS wakes this file
// roughly every 15 minutes ('syncReports') and it posts whatever is still waiting.

addEventListener('setPending', (resolve, reject, args) => {
  try {
    CapacitorKV.set('pending', JSON.stringify((args && args.list) || []));
    resolve();
  } catch (e) { reject(e); }
});

addEventListener('syncReports', async (resolve, reject, args) => {
  try {
    const got = CapacitorKV.get('pending');
    const list = got && got.value ? JSON.parse(got.value) : [];
    const left = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      try {
        const res = await fetch(it.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: it.body
        });
        let ok = true;                       // a reply we cannot read still means it was delivered
        try { const j = await res.json(); ok = !!(j && j.ok); } catch (e) { ok = true; }
        if (!ok) left.push(it);
      } catch (e) {
        left.push(it);                       // no internet yet - try again next time
      }
    }
    CapacitorKV.set('pending', JSON.stringify(left));
    resolve();
  } catch (e) { reject(e); }
});
