(() => {
  const grid = document.getElementById('books-grid');
  const search = document.getElementById('search-input');
  const sort = document.getElementById('sort-select');
  const count = document.getElementById('results-count');
  const languageFilters = [...document.querySelectorAll('.language-checkbox')];
  const statusButtons = [...document.querySelectorAll('[data-status]')];
  let books = [];
  let selection = [];
  let status = 'all';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const readingTime = book => {
    const value = String(book.read_date || '').trim();
    if (!/^\d{4}(?:-\d{2}){0,2}$/.test(value)) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  };
  const rating = book => Number.isFinite(Number(book.rating)) ? Number(book.rating) : 0;
  const formatDate = time => new Intl.DateTimeFormat('en', {month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(time));

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const languages = languageFilters.filter(input => input.checked).map(input => input.value);
    selection = books.filter(book => {
      const read = readingTime(book) !== null;
      const matchesStatus = status === 'all' || (status === 'read' ? read : !read);
      const haystack = [book.title,book.author,book.language,book.read_date,book.published_year,book.notes,...(Array.isArray(book.tags) ? book.tags : [])].join(' ').toLocaleLowerCase();
      return languages.includes(book.language) && matchesStatus && haystack.includes(query);
    });
    const byTitle = (a,b) => String(a.title || '').localeCompare(String(b.title || ''));
    selection.sort((a,b) => {
      switch (sort.value) {
        case 'rating-asc': return rating(a)-rating(b) || byTitle(a,b);
        case 'title-asc': return byTitle(a,b);
        case 'title-desc': return byTitle(b,a);
        case 'date-desc': return (readingTime(b) ?? -Infinity)-(readingTime(a) ?? -Infinity) || byTitle(a,b);
        default: return rating(b)-rating(a) || byTitle(a,b);
      }
    });
    count.textContent = `${selection.length} of ${books.length} books`;
    grid.setAttribute('aria-busy','false');
    if (selection.length) {
      grid.innerHTML = selection.map((book,index) => {
        const time = readingTime(book);
        const titleLanguage = book.language === 'Persian' ? 'fa' : 'en';
        const dateLabel = time !== null ? `Read ${formatDate(time)}` : 'To read';
        const bookRating = Number.isFinite(Number(book.rating)) ? Number(book.rating).toFixed(1) : '\u2014';
        return `<article class="book-card">
          <span class="book-index micro" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>
          <div class="book-content">
            <div class="book-top"><div><h3 class="book-title" dir="auto" lang="${titleLanguage}">${escapeHtml(book.title)}</h3><p class="book-author" dir="auto">${escapeHtml(book.author)}</p></div><div class="book-rating" aria-label="Rating: ${bookRating} out of 5"><strong>${bookRating}</strong><span class="micro">/ 5</span></div></div>
            <div class="book-meta micro"><span class="book-status">${escapeHtml(dateLabel)}</span><span>${escapeHtml(book.language)}</span>${book.published_year ? `<span>Published ${escapeHtml(book.published_year)}</span>` : ''}</div>
            <div class="book-tags micro">${(Array.isArray(book.tags) ? book.tags : []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            ${book.notes ? `<details class="book-note"><summary>Reading note</summary><p>${escapeHtml(book.notes)}</p></details>` : ''}
          </div>
        </article>`;
      }).join('');
    } else {
      grid.innerHTML = '<div class="empty-state"><p>No books match these filters.</p><button class="reset-empty" type="button" data-reset>Reset filters</button></div>';
    }
    window.renderReadingTimeline?.(selection);
  }
  function setStatus(value) {
    status = value;
    statusButtons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.status === status)));
  }
  function reset() {
    search.value = '';
    sort.value = 'rating-desc';
    languageFilters.forEach(input => {input.checked = true;});
    setStatus('all');
    render();
  }
  async function load() {
    grid.setAttribute('aria-busy','true');
    try {
      const response = await fetch('./books.json');
      if (!response.ok) throw new Error(`Books request failed: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('The book list is not an array');
      books = data.filter(book => book && typeof book === 'object');
      const readCount = books.filter(book => readingTime(book) !== null).length;
      document.getElementById('total-books').textContent = String(books.length);
      document.getElementById('read-books').textContent = String(readCount);
      document.getElementById('planned-books').textContent = String(books.length-readCount);
      render();
    } catch (error) {
      grid.setAttribute('aria-busy','false');
      count.textContent = 'Book list unavailable';
      grid.innerHTML = '<div class="empty-state"><p>The book list could not be loaded.</p><button type="button" class="reset-empty" data-retry>Try again</button></div>';
      document.getElementById('reading-timeline-meta').textContent = 'Reading history is unavailable.';
      console.error(error);
    }
  }
  search.addEventListener('input',render);
  sort.addEventListener('change',render);
  languageFilters.forEach(input => input.addEventListener('change',render));
  statusButtons.forEach(button => button.addEventListener('click',() => {setStatus(button.dataset.status);render();}));
  document.getElementById('reset-filters').addEventListener('click',reset);
  grid.addEventListener('click',event => {
    if (event.target.closest('[data-reset]')) reset();
    if (event.target.closest('[data-retry]')) load();
  });
  window.setupReadingTimelineResize?.(() => selection);
  load();
})();
