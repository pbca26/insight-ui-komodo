function getCoinUrlParam(url) {
  const params = url.match(/\/coin\/(.+)/);

  if (params &&
      params[1]) {
    return params[1];
  }
}