import { initSharedApp } from '../app.js';
import { renderHome } from '../features/home.js';

initSharedApp('home');
renderHome(document.getElementById('pageRoot'));
