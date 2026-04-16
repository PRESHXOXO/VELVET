import { initSharedApp } from '../app.js';
import { mountHomePage } from '../features/home.js';

initSharedApp('home');
mountHomePage(document.getElementById('pageRoot'));
