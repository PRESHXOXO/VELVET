import { initSharedApp } from '../app.js';
import { renderSearchPage } from '../features/search.js';

initSharedApp('search');
renderSearchPage(document.getElementById('pageRoot'));
