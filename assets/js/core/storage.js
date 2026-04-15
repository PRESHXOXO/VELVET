const parse = (raw, fallback) => {
  try{
    return raw ? JSON.parse(raw) : fallback;
  }catch(_err){
    return fallback;
  }
};

export function readStorage(key, fallback){
  return parse(localStorage.getItem(key), fallback);
}

export function writeStorage(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(_err){}
}

export function readSession(key, fallback){
  return parse(sessionStorage.getItem(key), fallback);
}

export function writeSession(key, value){
  try{
    sessionStorage.setItem(key, JSON.stringify(value));
  }catch(_err){}
}
