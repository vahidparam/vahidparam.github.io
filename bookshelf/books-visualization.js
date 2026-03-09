(function () {
  function parseBookDate(value) {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    const nativeDate = new Date(raw);
    if (!Number.isNaN(nativeDate.getTime())) return nativeDate;

    const yearOnly = raw.match(/^\d{4}$/);
    if (yearOnly) return new Date(Number(yearOnly[0]), 0, 1);

    const ymd = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    }

    return null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(date, withDay = true) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      ...(withDay ? { day: "numeric" } : {})
    }).format(date);
  }

  function formatTickDate(date, spanMs) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const sixMonths = 183 * 24 * 60 * 60 * 1000;

    if (spanMs > oneYear * 2) {
      return new Intl.DateTimeFormat("en", { year: "numeric" }).format(date);
    }

    if (spanMs > sixMonths) {
      return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(date);
    }

    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  }

  function buildLinePath(points) {
    if (!points.length) return "";
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }

  function getTimeTicks(minTime, maxTime, count) {
    const ticks = [];
    const span = maxTime - minTime;

    if (span <= 0) {
      ticks.push(minTime);
      return ticks;
    }

    for (let i = 0; i < count; i += 1) {
      ticks.push(minTime + (span * i) / (count - 1));
    }

    return ticks;
  }

  function showTooltip(tooltip, container, event, book) {
    if (!tooltip || !container || !book) return;

    tooltip.hidden = false;
    tooltip.innerHTML = `
      <div class="tooltip-title">${escapeHtml(book.title || "Untitled")}</div>
      <div class="tooltip-author">${escapeHtml(book.author || "Unknown author")}</div>
      <div class="tooltip-row"><strong>Read:</strong> ${escapeHtml(book.read_date || "—")}</div>
      <div class="tooltip-row"><strong>Rating:</strong> ${Number(book.rating || 0).toFixed(1)}/5</div>
      <div class="tooltip-row"><strong>Language:</strong> ${escapeHtml(book.language || "Unknown")}</div>
      ${book.published_year ? `<div class="tooltip-row"><strong>Published:</strong> ${escapeHtml(book.published_year)}</div>` : ""}
    `;

    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let x = event.clientX - containerRect.left + 14;
    let y = event.clientY - containerRect.top + 14;

    if (x + tooltipRect.width > containerRect.width - 8) {
      x = event.clientX - containerRect.left - tooltipRect.width - 14;
    }

    if (y + tooltipRect.height > containerRect.height - 8) {
      y = event.clientY - containerRect.top - tooltipRect.height - 14;
    }

    x = clamp(x, 8, Math.max(8, containerRect.width - tooltipRect.width - 8));
    y = clamp(y, 8, Math.max(8, containerRect.height - tooltipRect.height - 8));

    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function hideTooltip(tooltip) {
    if (!tooltip) return;
    tooltip.hidden = true;
    tooltip.style.transform = "translate(-9999px, -9999px)";
  }

  function renderReadingTimeline(data, options = {}) {
    const {
      targetId = "reading-timeline",
      metaId = "reading-timeline-meta",
      tooltipId = "timeline-tooltip"
    } = options;

    const container = document.getElementById(targetId);
    const meta = document.getElementById(metaId);
    const tooltip = document.getElementById(tooltipId);

    if (!container) return;

    const rawBooks = Array.isArray(data) ? data : [];

    const datedBooks = rawBooks
      .map(book => {
        const parsedDate = parseBookDate(book.read_date);
        const rating = clamp(Number(book.rating || 0), 0, 5);

        return {
          ...book,
          _date: parsedDate,
          _rating: Number.isFinite(rating) ? rating : 0
        };
      })
      .filter(book => book._date)
      .sort((a, b) => a._date - b._date);

    const undatedCount = rawBooks.length - datedBooks.length;

    if (!datedBooks.length) {
      container.innerHTML = `
        <div class="timeline-empty">
          Add valid <code>read_date</code> values in <code>books.json</code> to see your reading timeline.
        </div>
      `;

      if (meta) {
        meta.textContent = rawBooks.length
          ? "No valid reading dates found in the current selection."
          : "Hover points to inspect books over time.";
      }

      hideTooltip(tooltip);
      return;
    }

    const width = Math.max(container.clientWidth || 320, 320);
    const height = 220;
    const margin = { top: 18, right: 18, bottom: 34, left: 36 };

    let minTime = datedBooks[0]._date.getTime();
    let maxTime = datedBooks[datedBooks.length - 1]._date.getTime();

    if (minTime === maxTime) {
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      minTime -= twoWeeks;
      maxTime += twoWeeks;
    }

    const xScale = time =>
      margin.left + ((time - minTime) / (maxTime - minTime)) * (width - margin.left - margin.right);

    const yScale = rating =>
      height - margin.bottom - ((rating - 0) / (5 - 0)) * (height - margin.top - margin.bottom);

    const yTicks = [1, 2, 3, 4, 5];
    const timeTicks = getTimeTicks(minTime, maxTime, 5);
    const points = datedBooks.map(book => ({
      x: xScale(book._date.getTime()),
      y: yScale(book._rating),
      book
    }));

    const linePath = buildLinePath(points);
    const spanMs = maxTime - minTime;

    container.innerHTML = `
      <svg
        class="timeline-svg"
        viewBox="0 0 ${width} ${height}"
        aria-label="Reading timeline chart"
        role="img"
      >
        ${yTicks.map(tick => `
          <line
            class="timeline-grid"
            x1="${margin.left}"
            y1="${yScale(tick)}"
            x2="${width - margin.right}"
            y2="${yScale(tick)}"
          ></line>
          <text
            class="timeline-label"
            x="${margin.left - 10}"
            y="${yScale(tick) + 4}"
            text-anchor="end"
          >${tick}</text>
        `).join("")}

        ${timeTicks.map(tick => `
          <line
            class="timeline-axis"
            x1="${xScale(tick)}"
            y1="${height - margin.bottom}"
            x2="${xScale(tick)}"
            y2="${height - margin.bottom + 6}"
          ></line>
          <text
            class="timeline-label"
            x="${xScale(tick)}"
            y="${height - 10}"
            text-anchor="middle"
          >${escapeHtml(formatTickDate(new Date(tick), spanMs))}</text>
        `).join("")}

        <line
          class="timeline-axis"
          x1="${margin.left}"
          y1="${height - margin.bottom}"
          x2="${width - margin.right}"
          y2="${height - margin.bottom}"
        ></line>

        <path class="timeline-line" d="${linePath}"></path>

        ${points.map((point, index) => `
          <circle
            class="timeline-point"
            cx="${point.x}"
            cy="${point.y}"
            r="5.2"
            tabindex="0"
            data-index="${index}"
            aria-label="${escapeHtml(point.book.title || "Book")} read ${escapeHtml(point.book.read_date || "")}"
          ></circle>
        `).join("")}
      </svg>
    `;

    if (meta) {
      meta.textContent = `${datedBooks.length} dated book${datedBooks.length > 1 ? "s" : ""} from ${formatDate(new Date(minTime), false)} to ${formatDate(new Date(maxTime), false)}${undatedCount > 0 ? ` · ${undatedCount} without read dates` : ""}.`;
    }

    const pointNodes = container.querySelectorAll(".timeline-point");

    pointNodes.forEach(node => {
      const index = Number(node.dataset.index);
      const book = datedBooks[index];

      const activate = event => {
        pointNodes.forEach(p => p.classList.remove("is-active"));
        node.classList.add("is-active");
        showTooltip(tooltip, container, event, book);
      };

      const deactivate = () => {
        node.classList.remove("is-active");
        hideTooltip(tooltip);
      };

      node.addEventListener("mouseenter", activate);
      node.addEventListener("mousemove", activate);
      node.addEventListener("mouseleave", deactivate);

      node.addEventListener("focus", () => {
        const rect = node.getBoundingClientRect();
        const syntheticEvent = {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top - 4
        };
        activate(syntheticEvent);
      });

      node.addEventListener("blur", deactivate);

      node.addEventListener("click", event => {
        activate(event);
      });
    });
  }

  function setupReadingTimelineResize(getData, options = {}) {
    let frame = null;

    window.addEventListener("resize", () => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const data = typeof getData === "function" ? getData() : [];
        renderReadingTimeline(data, options);
      });
    });
  }

  window.renderReadingTimeline = renderReadingTimeline;
  window.setupReadingTimelineResize = setupReadingTimelineResize;
})();