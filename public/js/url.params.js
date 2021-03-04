function getCoinUrlParam(url) {
  const params = url.match(/\/([^\/]+)\/?$/)[1];

  return params;
}