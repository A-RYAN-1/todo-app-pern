// Daily call caps for the model, so the free tier cannot be drained. In memory:
// one API instance, resets on restart and at the UTC day change. When a cap is
// reached the caller falls back to the rule parser, which costs nothing.
function createQuota({ perUser, total, now = () => new Date() }) {
  let day = "";
  let used = 0;
  const byUser = new Map();
  const roll = () => {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
      byUser.clear();
    }
  };
  return {
    // Returns true and counts the call when both caps allow it.
    take(userId) {
      roll();
      const mine = byUser.get(userId) || 0;
      if (mine >= perUser || used >= total) return false;
      byUser.set(userId, mine + 1);
      used += 1;
      return true;
    },
    usage() {
      roll();
      return { total: used };
    },
  };
}

module.exports = { createQuota };
