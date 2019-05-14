function getCoinUrlParam(url) {
  const params = url.match(/\/coin\/(.+)/);

  if (params &&
      params[1]) {
    return params[1].indexOf('/') > -1 ? params[1].replace('/', '') : params[1];
  }
}