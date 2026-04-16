import { initSharedApp } from '../app.js';
import { mountSearchPage } from '../features/search.js';

initSharedApp('search');
mountSearchPage(document.getElementById('pageRoot'));
