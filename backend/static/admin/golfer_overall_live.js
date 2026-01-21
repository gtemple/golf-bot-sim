(function () {
  function toInt(v) {
    var n = parseFloat(String(v || "").trim());
    if (Number.isNaN(n)) return 0;
    // clamp 0..100 just like your validators
    return Math.max(0, Math.min(100, n));
  }

  function computeOverall(fieldIds) {
    var sum = 0;
    var count = 0;

    fieldIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      sum += toInt(el.value);
      count += 1;
    });

    if (!count) return 0;
    return Math.round(sum / count);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var overallEl = document.getElementById("overall-live");
    if (!overallEl) return;

    // Django admin input IDs are usually "id_<fieldname>"
    var ratingFields = [
      "driving_power",
      "driving_accuracy",
      "approach",
      "short_game",
      "putting",
      "ball_striking",
      "consistency",
      "course_management",
      "discipline",
      "sand",
      "clutch",
      "risk_tolerance",
      "weather_handling",
      "endurance",
    ].map(function (f) {
      return "id_" + f;
    });

    function refresh() {
      overallEl.textContent = String(computeOverall(ratingFields));
    }

    // Initial paint
    refresh();

    // Update on any edits
    ratingFields.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", refresh);
      el.addEventListener("change", refresh);
    });
  });
})();
