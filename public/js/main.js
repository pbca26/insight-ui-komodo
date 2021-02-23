// Source: public/src/js/app.js
var testnet = false;
var netSymbol = window.netSymbol;

var defaultLanguage = 'en';
var defaultCurrency = netSymbol;

angular.module('insight',[
  'ngAnimate',
  'ngResource',
  'ngRoute',
  'ngProgress',
  'ui.bootstrap',
  'ui.route',
  'monospaced.qrcode',
  'gettext',
  'angularMoment',
  'insight.system',
  'insight.socket',
  'insight.blocks',
  'insight.transactions',
  'insight.address',
  'insight.search',
  'insight.charts',
  'insight.status',
  'insight.connection',
  'insight.currency',
  'insight.messages',
  'insight.searchAssets',
  'insight.tokens'
]);

angular.module('insight.system', []);
angular.module('insight.socket', []);
angular.module('insight.blocks', []);
angular.module('insight.transactions', []);
angular.module('insight.address', []);
angular.module('insight.search', []);
angular.module('insight.charts', []);
angular.module('insight.status', []);
angular.module('insight.connection', []);
angular.module('insight.currency', []);
angular.module('insight.messages', []);
angular.module('insight.searchAssets', []);
angular.module('insight.tokens', []);

// Source: public/src/js/controllers/address.js
angular.module('insight.address').controller('AddressController',
  function($scope, $rootScope, $routeParams, $location, Global, Address, getSocket) {
    $scope.global = Global;

    var socket = getSocket($scope);
    var addrStr = $routeParams.addrStr;

    var _startSocket = function() {
      socket.on('bitcoind/addresstxid', function(data) {
        if (data.address === addrStr) {
          $rootScope.$broadcast('tx', data.txid);
          var base = document.querySelector('base');
          var beep = new Audio(base.href + '/sound/transaction.mp3');
          beep.play();
        }
      });
      socket.emit('subscribe', 'bitcoind/addresstxid', [addrStr]);
    };

    var _stopSocket = function () {
      socket.emit('unsubscribe', 'bitcoind/addresstxid', [addrStr]);
    };

    socket.on('connect', function() {
      _startSocket();
    });

    $scope.$on('$destroy', function(){
      _stopSocket();
    });

    $scope.params = $routeParams;

    $scope.findOne = function() {
      $rootScope.currentAddr = $routeParams.addrStr;
      _startSocket();

      Address.get({
          addrStr: $routeParams.addrStr
        },
        function(address) {
          $rootScope.titleDetail = address.addrStr.substring(0, 7) + '...';
          $rootScope.flashMessage = null;
          $scope.address = address;
        },
        function(e) {
          if (e.status === 400) {
            $rootScope.flashMessage = 'Invalid Address: ' + $routeParams.addrStr;
          } else if (e.status === 503) {
            $rootScope.flashMessage = 'Backend Error. ' + e.data;
          } else {
            $rootScope.flashMessage = 'Address Not Found';
          }
          $location.path('/coin/' + $rootScope.coin);
        });
    };

  });

// Source: public/src/js/controllers/blocks.js
angular.module('insight.blocks').controller('BlocksController',
  function($scope, $rootScope, $routeParams, $location, Global, Block, Blocks, BlockByHeight) {
  $scope.global = Global;
  $scope.loading = false;

  if ($routeParams.blockHeight) {
    BlockByHeight.get({
      blockHeight: $routeParams.blockHeight
    }, function(hash) {
      $location.path('/block/' + hash.blockHash + '/coin/' + $rootScope.coin);
    }, function() {
      $rootScope.flashMessage = 'Bad Request';
      $location.path('/coin/' + $rootScope.coin);
    });
  }

  //Datepicker
  var _formatTimestamp = function (date) {
    var yyyy = date.getUTCFullYear().toString();
    var mm = (date.getUTCMonth() + 1).toString(); // getMonth() is zero-based
    var dd  = date.getUTCDate().toString();

    return yyyy + '-' + (mm[1] ? mm : '0' + mm[0]) + '-' + (dd[1] ? dd : '0' + dd[0]); //padding
  };

  $scope.$watch('dt', function(newValue, oldValue) {
    if (newValue !== oldValue) {
      $location.path('/blocks-date/' + _formatTimestamp(newValue) + '/coin/' + $rootScope.coin);
    }
  });

  $scope.openCalendar = function($event) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.opened = true;
  };

  $scope.humanSince = function(time) {
    var m = moment.unix(time).startOf('day');
    var b = moment().startOf('day');
    return moment.min(m).from(b);
  };

  $scope.list = function() {
    $scope.loading = true;

    if ($routeParams.blockDate) {
      $scope.detail = 'On ' + $routeParams.blockDate;
    }

    if ($routeParams.startTimestamp) {
      var d=new Date($routeParams.startTimestamp*1000);
      var m=d.getMinutes();
      if (m<10) m = '0' + m;
      $scope.before = ' before ' + d.getHours() + ':' + m;
    }

    $rootScope.titleDetail = $scope.detail;

    Blocks.get({
      blockDate: $routeParams.blockDate,
      startTimestamp: $routeParams.startTimestamp
    }, function(res) {
      $scope.loading = false;
      $scope.blocks = res.blocks;
      $scope.pagination = res.pagination;
    });
  };

  $scope.findOne = function() {
    $scope.loading = true;

    Block.get({
      blockHash: $routeParams.blockHash
    }, function(block) {
      $rootScope.titleDetail = block.height;
      $rootScope.flashMessage = null;
      $scope.loading = false;
      $scope.block = block;
    }, function(e) {
      if (e.status === 400) {
        $rootScope.flashMessage = 'Invalid Transaction ID: ' + $routeParams.txId;
      }
      else if (e.status === 503) {
        $rootScope.flashMessage = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.flashMessage = 'Block Not Found';
      }
      $location.path('/coin/' + $rootScope.coin);
    });
  };

  $scope.params = $routeParams;

});

angular.module('insight.searchAssets').controller('AssetsSearchController',
  function($scope, $rootScope, $routeParams, $location, $http) {
  $scope.balanceLoading = true;
  $scope.transactionsLoading = true;
  $scope.balance = [];
  $scope.transactions = [];
  $scope.transactionsAll = [];
  $scope.txChunkSize = 10;
  $scope.txChunk = 0;

  // ref: https://github.com/pbca26/agama-wallet-lib/blob/dev/src/time.js#L1
  $scope.secondsToString = function(seconds, skipMultiply, showSeconds) {
    var a = new Date(seconds * (skipMultiply ? 1 : 1000));
    var months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours() < 10 ? `0${a.getHours()}` : a.getHours();
    var min = a.getMinutes() < 10 ? `0${a.getMinutes()}` : a.getMinutes();
    var sec = a.getSeconds();
    var time = `${date} ${month} ${year} ${hour}:${min}${(showSeconds ? `:${sec}` : '')}`;
  
    return time;
  };

  $scope.loadMore = function() {
    if ($scope.txChunkSize * $scope.txChunk < $scope.transactionsAll.length) {
      $scope.txChunk++;
    }

    $scope.transactions = $scope.transactions.concat($scope.transactionsAll.slice($scope.txChunkSize * $scope.txChunk, $scope.txChunkSize * ($scope.txChunk + 1)));
  }

  if ($routeParams.address &&
      $routeParams.address.length === 34) {
    $http.get('https://www.atomicexplorer.com/api/explorer/search?term=' + $routeParams.address + '&transactions=false').then(function(response) {
    //$http.get('/public/js/search.mock.json').then(function(response) {
      if (response.data &&
          response.data.msg &&
          response.data.msg === 'success') {
        for (var i = 0; i < response.data.result.balance.length; i++) {
          if (response.data.result.balance[i] !== 'error' &&
              response.data.result.balance[i].coin !== 'CHIPS' &&
              (response.data.result.balance[i].balance.confirmed > 0 || response.data.result.balance[i].balance.unconfirmed > 0)) {
            $scope.balance.push(response.data.result.balance[i]);
          }
        }

        $scope.balanceLoading = false;
      } else {
        $scope.balanceLoading = false;
      }

      $scope.address = $routeParams.address;
    });

    $http.get('https://www.atomicexplorer.com/api/explorer/search?term=' + $routeParams.address + '&balance=false').then(function(response) {
      //$http.get('/public/js/search.mock.json').then(function(response) {
        if (response.data &&
            response.data.msg &&
            response.data.msg === 'success') {
          for (var i = 0; i < response.data.result.transactions.length; i++) {
            if (response.data.result.transactions[i] !== 'error' &&
                response.data.result.transactions[i].coin !== 'CHIPS') {
              $scope.transactionsAll.push(response.data.result.transactions[i]);
            }
          }
  
          $scope.transactions = $scope.transactions.concat($scope.transactionsAll.slice($scope.txChunk, $scope.txChunkSize));
  
          $scope.transactionsLoading = false;
        } else {
          $scope.transactionsLoading = false;
        }
  
        $scope.address = $routeParams.address;
      });
  } else {
    $scope.transactionsLoading = false;
    $scope.balanceLoading = false;
    $scope.transactions = [];
    $scope.balance = [];
  }
});

// Source: public/src/js/controllers/charts.js
angular.module('insight.charts').controller('ChartsController',
  function($scope, $rootScope, $routeParams, $location, Chart, Charts) {
  $scope.loading = false;

  if (!$routeParams.chartType) $routeParams.chartType = 'difficulty';

  $scope.list = function() {
    Charts.get({
    }, function(res) {
      $scope.charts = res.charts;
    });

    if ($routeParams.chartType) {
      $scope.chart();
    }
  };

  $scope.chart = function() {
    $scope.loading = true;

    Chart.get({
      chartType: $routeParams.chartType
    }, function(chart) {
      $scope.loading = false;
      $scope.chartType = $routeParams.chartType;
      $scope.chartName = chart.name;
      $scope.chart = c3.generate(chart);
    }, function(e) {
      if (e.status === 400) {
        $rootScope.flashMessage = 'Invalid chart: ' + $routeParams.chartType;
      }
      else if (e.status === 503) {
        $rootScope.flashMessage = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.flashMessage = 'Chart Not Found';
      }
      $location.path('/coin/' + $rootScope.coin);
    });
  };

  $scope.params = $routeParams;

});

// Source: public/src/js/controllers/connection.js
angular.module('insight.connection').controller('ConnectionController',
  function($scope, $window, Status, getSocket, PeerSync) {

    // Set initial values
    $scope.apiOnline = true;
    $scope.serverOnline = true;
    $scope.clienteOnline = true;

    var socket = getSocket($scope);

    // Check for the node server connection
    socket.on('connect', function() {
      $scope.serverOnline = true;
      socket.on('disconnect', function() {
        $scope.serverOnline = false;
      });
    });

    // Check for the  api connection
    $scope.getConnStatus = function() {
      PeerSync.get({},
        function(peer) {
          $scope.apiOnline = peer.connected;
          $scope.host = peer.host;
          $scope.port = peer.port;
        },
        function() {
          $scope.apiOnline = false;
        });
    };

    socket.emit('subscribe', 'sync');
    socket.on('status', function(sync) {
      $scope.sync = sync;
      $scope.apiOnline = (sync.status !== 'aborted' && sync.status !== 'error');
    });

    // Check for the client conneciton
    $window.addEventListener('offline', function() {
      $scope.$apply(function() {
        $scope.clienteOnline = false;
      });
    }, true);

    $window.addEventListener('online', function() {
      $scope.$apply(function() {
        $scope.clienteOnline = true;
      });
    }, true);

  });

// Source: public/src/js/controllers/currency.js
angular.module('insight.currency').controller('CurrencyController',
  function($scope, $rootScope, Currency) {
    $rootScope.currency.symbol = defaultCurrency;
    $rootScope.theme = 'dark';
    document.getElementById('body').className += ' dark';

    var _roundFloat = function(x, n) {
      if(!parseInt(n, 10) || !parseFloat(x)) n = 0;

      return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
    };

    $rootScope.currency.getConvertion = function(value) {
      value = value * 1; // Convert to number

      if (!isNaN(value) && typeof value !== 'undefined' && value !== null) {
        if (value === 0.00000000) return '0 ' + this.symbol; // fix value to show

        var response;

        if (this.symbol === 'USD') {
          response = _roundFloat((value * this.factor), 2);
        } else if (this.symbol === 'm'+netSymbol) {
          this.factor = 1000;
          response = _roundFloat((value * this.factor), 5);
        } else if (this.symbol === 'bits') {
          this.factor = 1000000;
          response = _roundFloat((value * this.factor), 2);
        } else {
          this.factor = 1;
          response = value;
        }
        // prevent sci notation
        if (response < 1e-7) response=response.toFixed(8);

        return response + ' ' + this.symbol;
      }

      return 'value error';
    };

    $scope.setCurrency = function(currency) {
      $rootScope.currency.symbol = currency;
      localStorage.setItem('insight-currency', currency);

      if (currency === 'USD') {
        Currency.get({}, function(res) {
          $rootScope.currency.factor = $rootScope.currency.bitstamp = res.data.bitstamp;
        });
      } else if (currency === 'm'+netSymbol) {
        $rootScope.currency.factor = 1000;
      } else if (currency === 'bits') {
        $rootScope.currency.factor = 1000000;
      } else {
        $rootScope.currency.factor = 1;
      }
    };

    $scope.setTheme = function(theme) {
      document.getElementById('body').className = document.getElementById('body').className.replace('dark', '');

      if (theme === 'dark') {
        document.getElementById('body').className += ' dark';
      }

      $rootScope.theme = theme;
    }

    // Get initial value
    Currency.get({}, function(res) {
      $rootScope.currency.factor = $rootScope.currency.bitstamp = res.data.bitstamp;
    });

  });

// ad rotator
angular.module('insight.system').controller('AdRotatorController',
function($scope, $rootScope, $routeParams, $location, $http) {
  var adRotatorInterval = 10 * 1000;
  
  $http.get('/public/js/rotate.json').then(function(response) {
    $scope.adIndex = 0;
    $scope.ads = shuffleArray(response.data);
    
    setInterval(function() {
      if ($scope.adIndex < $scope.ads.length - 1) {
        $scope.adIndex++;
      } else {
        $scope.adIndex = 0;
      }

      $scope.$apply();
    }, adRotatorInterval);
  });
});

// Source: public/src/js/controllers/footer.js
angular.module('insight.system').controller('FooterController',
  function($scope, $route, $templateCache, gettextCatalog, amMoment,  Version) {

    $scope.defaultLanguage = defaultLanguage;

    var _getVersion = function() {
      Version.get({},
        function(res) {
          $scope.version = res.version;
        });
    };

    $scope.version = _getVersion();

    $scope.availableLanguages = [{
      name: 'English',
      isoCode: 'en',
    }, {
      name: 'Deutsch',
      isoCode: 'de_DE',
    }, {
      name: 'Русский',
      isoCode: 'ru',
    }, {
      name: 'Spanish',
      isoCode: 'es',
    }, {
      name: 'Japanese',
      isoCode: 'ja',
    }];

    $scope.setLanguage = function(isoCode) {
      gettextCatalog.currentLanguage = $scope.defaultLanguage = defaultLanguage = isoCode;
      amMoment.changeLocale(isoCode);
      localStorage.setItem('insight-language', isoCode);
      var currentPageTemplate = $route.current.templateUrl;
      $templateCache.remove(currentPageTemplate);
      $route.reload();
    };

  });

// Source: public/src/js/controllers/header.js
angular.module('insight.system').controller('HeaderController',
  function($scope, $rootScope, $modal, getSocket, Global, Block, $location, $route) {
    var isTokensEnabledChain = _explorers[$rootScope.coin] && _explorers[$rootScope.coin].isTokens;
    $scope.global = Global;

    $rootScope.currency = {
      factor: 1,
      bitstamp: 0,
      testnet: testnet,
      netSymbol: netSymbol,
      symbol: netSymbol
    };

    $scope.menu = [{
      'title': 'Blocks',
      'link': 'blocks'
    }, {
      'title': 'Charts',
      'link': 'charts'
    }, {
      'title': 'Status',
      'link': 'status'
    }];

    if (isTokensEnabledChain) {
      $scope.menu.push({
        'title': 'Tokens',
        'link': 'tokens'
      })
    }

    $scope.explorers = explorers;

    $scope.openScannerModal = function() {
      var modalInstance = $modal.open({
        templateUrl: 'scannerModal.html',
        controller: 'ScannerController'
      });
    };

    var _getBlock = function(hash) {
      Block.get({
        blockHash: hash
      }, function(res) {
        $scope.totalBlocks = res.height;
      });
    };

    var socket = getSocket($scope);
    socket.on('connect', function() {
      socket.emit('subscribe', 'inv');

      socket.on('block', function(block) {
        var blockHash = block.toString();
        _getBlock(blockHash);
      });
    });

    $rootScope.isCollapsed = true;
  });

// Source: public/src/js/controllers/index.js
var TRANSACTION_DISPLAYED = 10;
var BLOCKS_DISPLAYED = 5;

angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, $http, Global, getSocket, Blocks) {
    $scope.global = Global;

    var _getNota = function() {
      $http.get('https://' + $rootScope.coin + '.explorer.dexstats.info/insight-api-komodo/status?q=getInfo').then(function(response) {
        if (response &&
            response.data &&
            response.data.info &&
            response.data.info.notarized) {
          $rootScope.notarized = response.data.info.notarized;
        }
      });
    };

    var _getBlocks = function() {
      Blocks.get({
        limit: BLOCKS_DISPLAYED
      }, function(res) {
        $scope.blocks = res.blocks;
        $scope.blocksLength = res.length;
      });
    };

    var socket = getSocket($scope);

    var _startSocket = function() { 
      socket.emit('subscribe', 'inv');
      socket.on('tx', function(tx) {
        $scope.txs.unshift(tx);
        if (parseInt($scope.txs.length, 10) >= parseInt(TRANSACTION_DISPLAYED, 10)) {
          $scope.txs = $scope.txs.splice(0, TRANSACTION_DISPLAYED);
        }
      });

      socket.on('block', function() {
        _getBlocks();
        _getNota();
      });
    };

    socket.on('connect', function() {
      _startSocket();
    });



    $scope.humanSince = function(time) {
      var m = moment.unix(time);
      return moment.min(m).fromNow();
    };

    $scope.index = function() {
      _getBlocks();
      _startSocket();
    };

    $scope.txs = [];
    $scope.blocks = [];
  });

// Source: public/src/js/controllers/messages.js
angular.module('insight.messages').controller('VerifyMessageController',
  function($scope, $http) {
  $scope.message = {
    address: '',
    signature: '',
    message: ''
  };
  $scope.verification = {
    status: 'unverified',  // ready|loading|verified|error
    result: null,
    error: null,
    address: ''
  };

  $scope.verifiable = function() {
    return ($scope.message.address
            && $scope.message.signature
            && $scope.message.message);
  };
  $scope.verify = function() {
    $scope.verification.status = 'loading';
    $scope.verification.address = $scope.message.address;
    $http.post(window.apiPrefix + '/messages/verify', $scope.message)
      .success(function(data, status, headers, config) {
        if(typeof(data.result) != 'boolean') {
          // API returned 200 but result was not true or false
          $scope.verification.status = 'error';
          $scope.verification.error = null;
          return;
        }

        $scope.verification.status = 'verified';
        $scope.verification.result = data.result;
      })
      .error(function(data, status, headers, config) {
        $scope.verification.status = 'error';
        $scope.verification.error = data;
      });
  };

  // Hide the verify status message on form change
  var unverify = function() {
    $scope.verification.status = 'unverified';
  };
  $scope.$watch('message.address', unverify);
  $scope.$watch('message.signature', unverify);
  $scope.$watch('message.message', unverify);
});

// Source: public/src/js/controllers/scanner.js
angular.module('insight.system').controller('ScannerController',
  function($scope, $rootScope, $modalInstance, Global) {
    $scope.global = Global;

    // Detect mobile devices
    var isMobile = {
      Android: function() {
          return navigator.userAgent.match(/Android/i);
      },
      BlackBerry: function() {
          return navigator.userAgent.match(/BlackBerry/i);
      },
      iOS: function() {
          return navigator.userAgent.match(/iPhone|iPad|iPod/i);
      },
      Opera: function() {
          return navigator.userAgent.match(/Opera Mini/i);
      },
      Windows: function() {
          return navigator.userAgent.match(/IEMobile/i);
      },
      any: function() {
          return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
      }
    };

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    $scope.isMobile = isMobile.any();
    $scope.scannerLoading = false;

    var $searchInput = angular.element(document.getElementById('search')),
        cameraInput,
        video,
        canvas,
        $video,
        context,
        localMediaStream;

    var _scan = function(evt) {
      if ($scope.isMobile) {
        $scope.scannerLoading = true;
        var files = evt.target.files;

        if (files.length === 1 && files[0].type.indexOf('image/') === 0) {
          var file = files[0];

          var reader = new FileReader();
          reader.onload = (function(theFile) {
            return function(e) {
              var mpImg = new MegaPixImage(file);
              mpImg.render(canvas, { maxWidth: 200, maxHeight: 200, orientation: 6 });

              setTimeout(function() {
                qrcode.width = canvas.width;
                qrcode.height = canvas.height;
                qrcode.imagedata = context.getImageData(0, 0, qrcode.width, qrcode.height);

                try {
                  //alert(JSON.stringify(qrcode.process(context)));
                  qrcode.decode();
                } catch (e) {
                  alert(e);
                }
              }, 1500);
            };
          })(file);

          // Read  in the file as a data URL
          reader.readAsDataURL(file);
        }
      } else {
        if (localMediaStream) {
          context.drawImage(video, 0, 0, 300, 225);

          try {
            qrcode.decode();
          } catch(e) {
            //qrcodeError(e);
          }
        }

        setTimeout(_scan, 500);
      }
    };

    var _successCallback = function(stream) {
      video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
      localMediaStream = stream;
      video.play();
      setTimeout(_scan, 1000);
    };

    var _scanStop = function() {
      $scope.scannerLoading = false;
      $modalInstance.close();
      if (!$scope.isMobile) {
        if (localMediaStream.stop) localMediaStream.stop();
        localMediaStream = null;
        video.src = '';
      }
    };

    var _videoError = function(err) {
      console.log('Video Error: ' + JSON.stringify(err));
      _scanStop();
    };

    qrcode.callback = function(data) {
      _scanStop();

      var str = (data.indexOf('komodo:') === 0) ? data.substring(8) : data;
      console.log('QR code detected: ' + str);
      $searchInput
        .val(str)
        .triggerHandler('change')
        .triggerHandler('submit');
    };

    $scope.cancel = function() {
      _scanStop();
    };

    $modalInstance.opened.then(function() {
      $rootScope.isCollapsed = true;
      
      // Start the scanner
      setTimeout(function() {
        canvas = document.getElementById('qr-canvas');
        context = canvas.getContext('2d');

        if ($scope.isMobile) {
          cameraInput = document.getElementById('qrcode-camera');
          cameraInput.addEventListener('change', _scan, false);
        } else {
          video = document.getElementById('qrcode-scanner-video');
          $video = angular.element(video);
          canvas.width = 300;
          canvas.height = 225;
          context.clearRect(0, 0, 300, 225);

          navigator.getUserMedia({video: true}, _successCallback, _videoError); 
        }
      }, 500);
    });
});

// Source: public/src/js/controllers/search.js
angular.module('insight.search').controller('SearchController',
  function($scope, $routeParams, $rootScope, $location, $timeout, Global, Block, Transaction, Address, BlockByHeight) {
  $scope.global = Global;
  $scope.loading = false;

  var _badQuery = function() {
    $scope.badQuery = true;

    $timeout(function() {
      $scope.badQuery = false;
    }, 2000);
  };

  var _resetSearch = function() {
    $scope.q = '';
    $scope.loading = false;
  };

  $scope.search = function() {
    var q = $scope.q;
    $scope.badQuery = false;
    $scope.loading = true;

    if ($rootScope.searchAssets) {
      if (q &&
          q.length === 34) { // address search only
        $location.path('search/assets/' + q);
        $scope.loading = false;
      } else {
        _badQuery();
      }
    } else {
      Block.get({
        blockHash: q
      }, function() {
        _resetSearch();
        $location.path('block/' + q + '/coin/' + $rootScope.coin);
      }, function() { //block not found, search on TX
        Transaction.get({
          txId: q
        }, function() {
          _resetSearch();
          $location.path('tx/' + q + '/coin/' + $rootScope.coin);
        }, function() { //tx not found, search on Address
          Address.get({
            addrStr: q
          }, function() {
            _resetSearch();
            $location.path('address/' + q + '/coin/' + $rootScope.coin);
          }, function() { // block by height not found
            if (isFinite(q)) { // ensure that q is a finite number. A logical height value.
              BlockByHeight.get({
                blockHeight: q
              }, function(hash) {
                _resetSearch();
                $location.path('/block/' + hash.blockHash + '/coin/' + $rootScope.coin);
              }, function() { //not found, fail :(
                $scope.loading = false;
                _badQuery();
              });
            }
            else {
              $scope.loading = false;
              _badQuery();
            }
          });
        });
      });
    }
  };

});

// Source: public/src/js/controllers/status.js
angular.module('insight.status').controller('StatusController',
  function($scope, $routeParams, $rootScope, $http, $location, Global, Status, Sync, getSocket) {
    $scope.global = Global;

    var _getNota = function() {
      $http.get('https://' + $rootScope.coin + '.explorer.dexstats.info/insight-api-komodo/status?q=getInfo').then(function(response) {
        if (response &&
            response.data &&
            response.data.info &&
            response.data.info.notarized) {
          $rootScope.notarized = response.data.info.notarized;
        }
      });
    };

    $scope.getStatus = function(q) {
      Status.get({
        q: 'get' + q
      },
      function(d) {
        $scope.loaded = 1;
        angular.extend($scope, d);
      },
      function(e) {
        $scope.error = 'API ERROR: ' + e.data;
      });
    };

    $scope.humanSince = function(time) {
      var m = moment.unix(time / 1000);
      return moment.min(m).fromNow();
    };

    var _onSyncUpdate = function(sync) {
      $scope.sync = sync;
      _getNota();
    };

    var _startSocket = function () {
      socket.emit('subscribe', 'sync');
      socket.on('status', function(sync) {
        _onSyncUpdate(sync);
      });
    };
    
    var socket = getSocket($scope);
    socket.on('connect', function() {
      _startSocket();
    });

    $scope.getSync = function() {
      _startSocket();
      Sync.get({},
        function(sync) {
          _onSyncUpdate(sync);
        },
        function(e) {
          var err = 'Could not get sync information' + e.toString();
          $scope.sync = {
            error: err
          };
        });
    };
  });

// Source: public/src/js/controllers/transactions.js
angular.module('insight.transactions').controller('transactionsController',
function($scope, $rootScope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress) {
  $scope.global = Global;
  $scope.loading = false;
  $scope.loadedBy = null;

  var pageNum = 0;
  var pagesTotal = 1;
  var COIN = 100000000;

  var _aggregateItems = function(items) {
    if (!items) return [];

    var l = items.length;

    var ret = [];
    var tmp = {};
    var u = 0;

    for(var i=0; i < l; i++) {

      var notAddr = false;
      // non standard input
      if (items[i].scriptSig && !items[i].addr) {
        items[i].addr = 'Unparsed address [' + u++ + ']';
        items[i].notAddr = true;
        notAddr = true;
      }

      // non standard output
      if (items[i].scriptPubKey && !items[i].scriptPubKey.addresses) {
        items[i].scriptPubKey.addresses = ['Unparsed address [' + u++ + ']'];
        items[i].notAddr = true;
        notAddr = true;
      }

      // multiple addr at output
      if (items[i].scriptPubKey && items[i].scriptPubKey.addresses.length > 1) {
        items[i].addr = items[i].scriptPubKey.addresses.join(',');
        ret.push(items[i]);
        continue;
      }

      var addr = items[i].addr || (items[i].scriptPubKey && items[i].scriptPubKey.addresses[0]);

      if (!tmp[addr]) {
        tmp[addr] = {};
        tmp[addr].valueSat = 0;
        tmp[addr].count = 0;
        tmp[addr].addr = addr;
        tmp[addr].items = [];
      }
      tmp[addr].isSpent = items[i].spentTxId;

      tmp[addr].doubleSpentTxID = tmp[addr].doubleSpentTxID   || items[i].doubleSpentTxID;
      tmp[addr].doubleSpentIndex = tmp[addr].doubleSpentIndex || items[i].doubleSpentIndex;
      tmp[addr].dbError = tmp[addr].dbError || items[i].dbError;
      tmp[addr].valueSat += Math.round(items[i].value * COIN);
      tmp[addr].items.push(items[i]);
      tmp[addr].notAddr = notAddr;

      if (items[i].unconfirmedInput)
        tmp[addr].unconfirmedInput = true;

      tmp[addr].count++;
    }

    angular.forEach(tmp, function(v) {
      v.value = v.value || parseInt(v.valueSat) / COIN;
      ret.push(v);
    });
    return ret;
  };

  var _processTX = function(tx) {
    tx.vinSimple = _aggregateItems(tx.vin);
    tx.voutSimple = _aggregateItems(tx.vout);
  };

  var _paginate = function(data) {
    $scope.loading = false;

    pagesTotal = data.pagesTotal;
    pageNum += 1;

    data.txs.forEach(function(tx) {
      _processTX(tx);
      $scope.txs.push(tx);
    });
  };

  var _byBlock = function() {
    TransactionsByBlock.get({
      block: $routeParams.blockHash,
      pageNum: pageNum
    }, function(data) {
      _paginate(data);
    });
  };

  var _byAddress = function () {
    TransactionsByAddress.get({
      address: $routeParams.addrStr,
      pageNum: pageNum
    }, function(data) {
      _paginate(data);
    });
  };

  var _findTx = function(txid) {
    Transaction.get({
      txId: txid
    }, function(tx) {
      $rootScope.titleDetail = tx.txid.substring(0,7) + '...';
      $rootScope.flashMessage = null;
      $scope.tx = tx;
      _processTX(tx);
      $scope.txs.unshift(tx);
    }, function(e) {
      if (e.status === 400) {
        $rootScope.flashMessage = 'Invalid Transaction ID: ' + $routeParams.txId;
      }
      else if (e.status === 503) {
        $rootScope.flashMessage = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.flashMessage = 'Transaction Not Found';
      }

      $location.path('/coin/' + $rootScope.coin);
    });
  };

  $scope.findThis = function() {
    _findTx($routeParams.txId);
  };

  //Initial load
  $scope.load = function(from) {
    $scope.loadedBy = from;
    $scope.loadMore();
  };

  //Load more transactions for pagination
  $scope.loadMore = function() {
    if (pageNum < pagesTotal && !$scope.loading) {
      $scope.loading = true;

      if ($scope.loadedBy === 'address') {
        _byAddress();
      }
      else {
        _byBlock();
      }
    }
  };

  // Highlighted txout
  if ($routeParams.v_type == '>' || $routeParams.v_type == '<') {
    $scope.from_vin = $routeParams.v_type == '<' ? true : false;
    $scope.from_vout = $routeParams.v_type == '>' ? true : false;
    $scope.v_index = parseInt($routeParams.v_index);
    $scope.itemsExpanded = true;
  }
  
  //Init without txs
  $scope.txs = [];

  $scope.$on('tx', function(event, txid) {
    _findTx(txid);
  });
});

angular.module('insight.transactions').controller('SendRawTransactionController',
  function($scope, $http) {
  $scope.transaction = '';
  $scope.status = 'ready';  // ready|loading|sent|error
  $scope.txid = '';
  $scope.error = null;

  $scope.formValid = function() {
    return !!$scope.transaction;
  };
  $scope.send = function() {
    var postData = {
      rawtx: $scope.transaction
    };
    $scope.status = 'loading';
    $http.post(window.apiPrefix + '/tx/send', postData)
      .success(function(data, status, headers, config) {
        if(typeof(data.txid) != 'string') {
          // API returned 200 but the format is not known
          $scope.status = 'error';
          $scope.error = 'The transaction was sent but no transaction id was got back';
          return;
        }

        $scope.status = 'sent';
        $scope.txid = data.txid;
      })
      .error(function(data, status, headers, config) {
        $scope.status = 'error';
        if(data) {
          $scope.error = data;
        } else {
          $scope.error = "No error message given (connection error?)"
        }
      });
  };
});

// Source: public/src/js/services/address.js
angular.module('insight.address').factory('Address',
  function($resource) {
  return $resource(window.apiPrefix + '/addr/:addrStr/?noTxList=1', {
    addrStr: '@addStr'
  }, {
    get: {
      method: 'GET',
      interceptor: {
        response: function (res) {
          return res.data;
        },
        responseError: function (res) {
          if (res.status === 404) {
            return res;
          }
        }
      }
    }
  });
});

 
// Source: public/src/js/services/blocks.js
angular.module('insight.blocks')
  .factory('Block',
    function($resource) {
    return $resource(window.apiPrefix + '/block/:blockHash', {
      blockHash: '@blockHash'
    }, {
      get: {
        method: 'GET',
        interceptor: {
          response: function (res) {
            return res.data;
          },
          responseError: function (res) {
            if (res.status === 404) {
              return res;
            }
          }
        }
      }
    });
  })
  .factory('Blocks',
    function($resource) {
      return $resource(window.apiPrefix + '/blocks');
  })
  .factory('BlockByHeight',
    function($resource) {
      return $resource(window.apiPrefix + '/block-index/:blockHeight');
  });

// Source: public/src/js/services/charts.js
angular.module('insight.charts')
  .factory('Chart',
    function($resource) {
    return $resource(window.apiPrefix + '/chart/:chartType', {
      chartType: '@chartType'
    }, {
      get: {
        method: 'GET',
        interceptor: {
          response: function (res) {
            return res.data;
          },
          responseError: function (res) {
            if (res.status === 404) {
              return res;
            }
          }
        }
      }
    });
  })
  .factory('Charts',
    function($resource) {
      return $resource(window.apiPrefix + '/charts');
  });

// Source: public/src/js/services/currency.js
angular.module('insight.currency').factory('Currency',
  function($resource) {
    return $resource(window.apiPrefix + '/currency');
});

// Source: public/src/js/services/global.js
//Global service for global variables
angular.module('insight.system')
  .factory('Global',[
    function() {
      return {};
    }
  ])
  .factory('Version',
    function($resource) {
      return $resource(window.apiPrefix + '/version');
  });

// Source: public/src/js/services/socket.js
var ScopedSocket = function(socket, $rootScope) {
  this.socket = socket;
  this.$rootScope = $rootScope;
  this.listeners = [];
};

ScopedSocket.prototype.removeAllListeners = function(opts) {
  if (!opts) opts = {};
  for (var i = 0; i < this.listeners.length; i++) {
    var details = this.listeners[i];
    if (opts.skipConnect && details.event === 'connect') {
      continue;
    }
    this.socket.removeListener(details.event, details.fn);
  }
  this.listeners = [];
};

ScopedSocket.prototype.on = function(event, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;

  var wrapped_callback = function() {
    var args = arguments;
    $rootScope.$apply(function() {
      callback.apply(socket, args);
    });
  };
  socket.on(event, wrapped_callback);

  this.listeners.push({
    event: event,
    fn: wrapped_callback
  });
};

ScopedSocket.prototype.emit = function(event, data, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;
  var args = Array.prototype.slice.call(arguments);

  args.push(function() {
    var args = arguments;
    $rootScope.$apply(function() {
      if (callback) {
        callback.apply(socket, args);
      }
    });
  });

  socket.emit.apply(socket, args);
};

angular.module('insight.socket').factory('getSocket',
  function($rootScope) {
    var socket = io.connect(window.urlPrefix, {
      'reconnect': true,
      'reconnection delay': 500,
    });
    return function(scope) {
      var scopedSocket = new ScopedSocket(socket, $rootScope);
      scope.$on('$destroy', function() {
        scopedSocket.removeAllListeners();
      });
      socket.on('connect', function() {
        scopedSocket.removeAllListeners({
          skipConnect: true
        });
      });
      return scopedSocket;
    };
  });

// Source: public/src/js/services/status.js
angular.module('insight.status')
  .factory('Status',
    function($resource) {
      return $resource(window.apiPrefix + '/status', {
        q: '@q'
      });
    })
  .factory('Sync',
    function($resource) {
      return $resource(window.apiPrefix + '/sync');
    })
  .factory('PeerSync',
    function($resource) {
      return $resource(window.apiPrefix + '/peer');
    });

// Source: public/src/js/services/transactions.js
angular.module('insight.transactions')
  .factory('Transaction',
    function($resource) {
    return $resource(window.apiPrefix + '/tx/:txId', {
      txId: '@txId'
    }, {
      get: {
        method: 'GET',
        interceptor: {
          response: function (res) {
            return res.data;
          },
          responseError: function (res) {
            if (res.status === 404) {
              return res;
            }
          }
        }
      }
    });
  })
  .factory('TransactionsByBlock',
    function($resource) {
    return $resource(window.apiPrefix + '/txs', {
      block: '@block'
    });
  })
  .factory('TransactionsByAddress',
    function($resource) {
    return $resource(window.apiPrefix + '/txs', {
      address: '@address'
    });
  })
  .factory('Transactions',
    function($resource) {
      return $resource(window.apiPrefix + '/txs');
  });

angular.module('insight.tokens')
  .factory('Tokens',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens');
    })
    .factory('TokensRichlist',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens/richlist', {
        cctxid: '@cctxid'
      });
    })
    .factory('TokensTransactions',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens/transactions/all', {
        cctxid: '@cctxid',
      });
    })
    .factory('TokenSpecificAddressBalance',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens/balance', {
        address: '@address',
        cctxid: '@cctxid',
      });
    })
    .factory('TokensAddressBalance',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens/balance', {
        address: '@address'
      });
    })
    .factory('TokensAddressTransactions',
    function($resource) {
      return $resource(window.apiPrefix + '/tokens/transactions', {
        address: '@address'
      });
    })

// Source: public/src/js/directives.js
var ZeroClipboard = window.ZeroClipboard;

angular.module('insight')
  .directive('searchSelector', function($document, $rootScope) {
    return {
      restrict: 'E',
      require: '?ngModel',
      scope: {
        coin: '=',
      },
      templateUrl: 'public/views/search-dropdown.html',
      replace: true,
      link: function(scope, element, attr) {
        scope.isOpened = false;

        scope.toggleSearchParams = function(param) {
          $rootScope.searchAssets = param;
        }

        scope.toggleSelect = function() {
          scope.isOpened = !scope.isOpened;
          document.getElementById('ngProgress-container').style.display = scope.isOpened ? 'none' : 'block';
        }

        $document.bind('click', function(event) {
          var isParentNodeClicked = false;
          
          for (var i = 0; i < event.path.length; i++) {
            if (event.path[i].className &&
                event.path[i].className.indexOf('search--dropdown') > -1) {
              isParentNodeClicked = true;
            }
          }

          if (!isParentNodeClicked) {
            document.getElementById('ngProgress-container').style.display = 'block';
            scope.isOpened = false;
            scope.$apply();
          }
        });
      }
    };
  })
  .directive('explorerSelector', function($document) {
    return {
      restrict: 'E',
      require: '?ngModel',
      scope: {
        coin: '=',
      },
      templateUrl: 'public/views/explorer-dropdown.html',
      replace: true,
      link: function(scope, element, attr) {
        scope.isOpened = false;
        scope.explorerQuickFilter = '';
        scope.explorers = explorers;
  
        scope.toggleSelect = function() {
          scope.isOpened = !scope.isOpened;
          scope.explorerQuickFilter = '';
          scope.explorers = explorers;
        }

        scope.keyup = function() {
          var items = [];
          
          if (scope.explorerQuickFilter) {
            for (var i = 0; i < explorers.length; i++) {
              if ((!explorers[i].hasOwnProperty('ext') && explorers[i].substring(0, scope.explorerQuickFilter.length).toLowerCase() === scope.explorerQuickFilter.toLowerCase()) ||
                  (explorers[i].hasOwnProperty('ext') && explorers[i].name.substring(0, scope.explorerQuickFilter.length).toLowerCase() === scope.explorerQuickFilter.toLowerCase())) {
                items.push(explorers[i]);
              }
            }

            scope.explorers = items;
          } else {
            scope.explorers = explorers;
          }
        }
  
        $document.bind('click', function(event) {
          var isParentNodeClicked = false;
          
          for (var i = 0; i < event.path.length; i++) {
            if (event.path[i].className &&
                event.path[i].className.indexOf('explorers--dropdown') > -1) {
              isParentNodeClicked = true;
            }
          }

          if (!isParentNodeClicked) {
            scope.isOpened = false;
            scope.$apply();
          }
        });
      }
    };
  })
  .directive('scroll', function ($window) {
    return function(scope, element, attrs) {
      angular.element($window).bind('scroll', function() {
        if (this.pageYOffset >= 200) {
          scope.secondaryNavbar = true;
        } else {
          scope.secondaryNavbar = false;
        }
        scope.$apply();
      });
    };
  })
  .directive('whenScrolled', function($window) {
    return {
      restric: 'A',
      link: function(scope, elm, attr) {
        var pageHeight, clientHeight, scrollPos;
        $window = angular.element($window);

        var handler = function() {
          pageHeight = window.document.documentElement.scrollHeight;
          clientHeight = window.document.documentElement.clientHeight;
          scrollPos = window.pageYOffset;

          if (pageHeight - (scrollPos + clientHeight) === 0) {
            scope.$apply(attr.whenScrolled);
          }
        };

        $window.on('scroll', handler);

        scope.$on('$destroy', function() {
          return $window.off('scroll', handler);
        });
      }
    };
  })
  .directive('clipCopy', function() {
    ZeroClipboard.config({
      moviePath: '/public/lib/zeroclipboard/ZeroClipboard.swf',
      trustedDomains: ['*'],
      allowScriptAccess: 'always',
      forceHandCursor: true
    });

    return {
      restric: 'A',
      scope: { clipCopy: '=clipCopy' },
      template: '<div class="tooltip fade right in"><div class="tooltip-arrow"></div><div class="tooltip-inner">Copied!</div></div>',
      link: function(scope, elm) {
        var clip = new ZeroClipboard(elm);

        clip.on('load', function(client) {
          var onMousedown = function(client) {
            client.setText(scope.clipCopy);
          };

          client.on('mousedown', onMousedown);

          scope.$on('$destroy', function() {
            client.off('mousedown', onMousedown);
          });
        });

        clip.on('noFlash wrongflash', function() {
          return elm.remove();
        });
      }
    };
  })
  .directive('focus', function ($timeout) {
    return {
      scope: {
        trigger: '@focus'
      },
      link: function (scope, element) {
        scope.$watch('trigger', function (value) {
          if (value === "true") {
            $timeout(function () {
              element[0].focus();
            });
          }
        });
      }
    };
  });

// Source: public/src/js/filters.js
angular.module('insight')
  .filter('startFrom', function() {
    return function(input, start) {
      start = +start; //parse to int
      return input.slice(start);
    }
  })
  .filter('split', function() {
    return function(input, delimiter) {
      var delimiter = delimiter || ',';
      return input.split(delimiter);
    }
  });

// Source: public/src/js/config.js
//Setting up route
angular.module('insight').config(function($routeProvider) {
  $routeProvider.
    when('/search/assets/:address', {
      templateUrl: 'public/views/search-assets.html',
      title: 'Komodo Asset Chains Search '
    }).
    when('/block/:blockHash/coin/:coin', {
      templateUrl: 'public/views/block.html',
      title: 'Komodo Block '
    }).
    when('/block-index/:blockHeight/coin/:coin', {
      controller: 'BlocksController',
      templateUrl: 'public/views/redirect.html'
    }).
    when('/tx/send/coin/:coin', {
      templateUrl: 'public/views/transaction_sendraw.html',
      title: 'Broadcast Raw Transaction'
    }).
    when('/tx/:txId/:v_type?/:v_index?/coin/:coin', {
      templateUrl: 'public/views/transaction.html',
      title: 'Komodo Transaction '
    }).
    when('/', {
      templateUrl: 'public/views/index.html',
      title: 'Home'
    }).
    when('/coin/:coin', {
      templateUrl: 'public/views/index.html',
      title: 'Home'
    }).
    when('/blocks/coin/:coin', {
      templateUrl: 'public/views/block_list.html',
      title: 'Komodo Blocks solved Today'
    }).
    when('/blocks-date/:blockDate/:startTimestamp?/coin/:coin', {
      templateUrl: 'public/views/block_list.html',
      title: 'Komodo Blocks solved '
    }).
    when('/address/:addrStr/coin/:coin', {
      templateUrl: 'public/views/address.html',
      title: 'Komodo Address '
    }).
    when('/charts/:chartType?/coin/:coin', {
      templateUrl: 'public/views/charts.html',
      title: 'Charts'
    }).
    when('/status/coin/:coin', {
      templateUrl: 'public/views/status.html',
      title: 'Status'
    }).
    when('/messages/verify/coin/:coin', {
      templateUrl: 'public/views/messages_verify.html',
      title: 'Verify Message'
    }).
    when('/tokens/coin/:coin', {
      templateUrl: 'views/tokens/tokens_list.html',
      title: 'Tokens'
    }).
    when('/tokens/:cctxid/transactions/coin/:coin', {
      templateUrl: 'views/tokens/token_overview.html',
      title: 'Token Transactions',
      isRichlist: false,
    }).
    when('/tokens/:cctxid/richlist/coin/:coin', {
      templateUrl: 'views/tokens/token_overview.html',
      title: 'Token Richlist',
      isRichlist: true,
    }).
    when('/tokens/:cctxid/address/:addrStr/coin/:coin', {
      templateUrl: 'views/tokens/token_address.html',
      title: 'Token Address Transactions',
    }).
    when('/tokens/address/:addrStr/coin/:coin', {
      templateUrl: 'views/tokens/token_address_overview.html',
      title: 'Token Address Overview',
    }).
    otherwise({
      templateUrl: 'public/views/404.html',
      title: 'Error'
    });
});

//Setting HTML5 Location Mode
angular.module('insight')
  .config(function($locationProvider) {
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
  })
  .run(function($rootScope, $route, $location, $routeParams, $anchorScroll, ngProgress, gettextCatalog, amMoment) {
    gettextCatalog.currentLanguage = defaultLanguage;
    amMoment.changeLocale(defaultLanguage);
    $rootScope.coin = window.netSymbol;
    
    $rootScope.$on('$routeChangeStart', function() {
      ngProgress.start();
    });

    $rootScope.$on('$routeChangeSuccess', function() {
      ngProgress.complete();

      //Change page title, based on Route information
      $rootScope.titleDetail = '';
      $rootScope.title = $route.current.title;
      $rootScope.isCollapsed = true;
      $rootScope.currentAddr = null;
      $rootScope.coin = window.netSymbol;

      $location.hash($routeParams.scrollTo);
      $anchorScroll();
    });
  });

// Source: public/src/js/init.js
angular.element(document).ready(function() {
  // Init the app
  // angular.bootstrap(document, ['insight']);
});

// Source: public/src/js/translations.js
angular.module('insight').run(['gettextCatalog', function (gettextCatalog) {
/* jshint -W100 */
    gettextCatalog.setStrings('de_DE', {"(Input unconfirmed)":"(Eingabe unbestätigt)","404 Page not found :(":"404 Seite nicht gefunden :(","<strong>insight</strong>  is an <a href=\"http://live.insight.is/\" target=\"_blank\">open-source Komodo blockchain explorer</a> with complete REST and websocket APIs that can be used for writing web wallets and other apps  that need more advanced blockchain queries than provided by komodod RPC.  Check out the <a href=\"https://github.com/supernetorg/insight-ui-komodo\" target=\"_blank\">source code</a>.":"<strong>insight</strong> ist ein <a href=\"http://live.insight.is/\" target=\"_blank\">Open Source Komodo Blockchain Explorer</a> mit vollständigen REST und Websocket APIs um eigene Wallets oder Applikationen zu implementieren. Hierbei werden fortschrittlichere Abfragen der Blockchain ermöglicht, bei denen die RPC des Komodod nicht mehr ausreichen. Der aktuelle <a href=\"https://github.com/supernetorg/insight-ui-komodo\" target=\"_blank\">Quellcode</a> ist auf Github zu finden.","<strong>insight</strong> is still in development, so be sure to report any bugs and provide feedback for improvement at our <a href=\"https://github.com/bitpay/insight/issues\" target=\"_blank\">github issue tracker</a>.":"<strong>insight</strong> befindet sich aktuell noch in der Entwicklung. Bitte sende alle gefundenen Fehler (Bugs) und Feedback zur weiteren Verbesserung an unseren <a href=\"https://github.com/supernetorg/insight-ui-komodo/issues\" target=\"_blank\">Github Issue Tracker</a>.","About":"Über insight","Address":"Adresse","Age":"Alter","Application Status":"Programmstatus","Best Block":"Bester Block","Komodo node information":"Komodo-Node Info","Block":"Block","Block Reward":"Belohnung","Blocks":"Blöcke","Bytes Serialized":"Serialisierte Bytes","Can't connect to komodod to get live updates from the p2p network. (Tried connecting to komodod at {{host}}:{{port}} and failed.)":"Es ist nicht möglich mit Komodod zu verbinden um live Aktualisierungen vom P2P Netzwerk zu erhalten. (Verbindungsversuch zu komodod an {{host}}:{{port}} ist fehlgeschlagen.)","Can't connect to insight server. Attempting to reconnect...":"Keine Verbindung zum insight-Server möglich. Es wird versucht die Verbindung neu aufzubauen...","Can't connect to internet. Please, check your connection.":"Keine Verbindung zum Internet möglich, bitte Zugangsdaten prüfen.","Complete":"Vollständig","Confirmations":"Bestätigungen","Conn":"Verbindungen","Connections to other nodes":"Verbindungen zu Nodes","Current Blockchain Tip (insight)":"Aktueller Blockchain Tip (insight)","Current Sync Status":"Aktueller Status","Details":"Details","Difficulty":"Schwierigkeit","Double spent attempt detected. From tx:":"Es wurde ein \"double Spend\" Versuch erkannt.Von tx:","Error!":"Fehler!","Fee":"Gebühr","Final Balance":"Schlussbilanz","Finish Date":"Fertigstellung","Go to home":"Zur Startseite","Hash Serialized":"Hash Serialisiert","Height":"Höhe","Included in Block":"Eingefügt in Block","Incoherence in levelDB detected:":"Es wurde eine Zusammenhangslosigkeit in der LevelDB festgestellt:","Info Errors":"Fehlerbeschreibung","Initial Block Chain Height":"Ursprüngliche Blockchain Höhe","Input":"Eingänge","Last Block":"Letzter Block","Last Block Hash (Komodod)":"Letzter Hash (Komodod)","Latest Blocks":"Letzte Blöcke","Latest Transactions":"Letzte Transaktionen","Loading Address Information":"Lade Adressinformationen","Loading Block Information":"Lade Blockinformation","Loading Selected Date...":"Lade gewähltes Datum...","Loading Transaction Details":"Lade Transaktionsdetails","Loading Transactions...":"Lade Transaktionen...","Loading...":"Lade...","Mined Time":"Block gefunden (Mining)","Mined by":"Gefunden von","Mining Difficulty":"Schwierigkeitgrad","Next Block":"Nächster Block","No Inputs (Newly Generated Coins)":"Keine Eingänge (Neu generierte Coins)","No blocks yet.":"Keine Blöcke bisher.","No matching records found!":"Keine passenden Einträge gefunden!","No. Transactions":"Anzahl Transaktionen","Number Of Transactions":"Anzahl der Transaktionen","Output":"Ausgänge","Powered by":"Powered by","Previous Block":"Letzter Block","Protocol version":"Protokollversion","Proxy setting":"Proxyeinstellung","Received Time":"Eingangszeitpunkt","Redirecting...":"Umleitung...","Search for block, transaction or address":"Suche Block, Transaktion oder Adresse","See all blocks":"Alle Blöcke anzeigen","Show Transaction Output data":"Zeige Abgänge","Show all":"Zeige Alles","Show input":"Zeige Eingänge","Show less":"Weniger anzeigen","Show more":"Mehr anzeigen","Size":"Größe","Size (bytes)":"Größe (bytes)","Skipped Blocks (previously synced)":"Verworfene Blöcke (bereits syncronisiert)","Start Date":"Startdatum","Status":"Status","Summary":"Zusammenfassung","Summary <small>confirmed</small>":"Zusammenfassung <small>bestätigt</small>","Sync Progress":"Fortschritt","Sync Status":"Syncronisation","Sync Type":"Art der Syncronisation","Synced Blocks":"Syncronisierte Blöcke","Testnet":"Testnet aktiv","There are no transactions involving this address.":"Es gibt keine Transaktionen zu dieser Adressse","Time Offset":"Zeitoffset zu UTC","Timestamp":"Zeitstempel","Today":"Heute","Total Amount":"Gesamtsumme","Total Received":"Insgesamt empfangen","Total Sent":"Insgesamt gesendet","Transaction":"Transaktion","Transaction Output Set Information":"Transaktions Abgänge","Transaction Outputs":"Abgänge","Transactions":"Transaktionen","Type":"Typ","Unconfirmed":"Unbestätigt","Unconfirmed Transaction!":"Unbestätigte Transaktion!","Unconfirmed Txs Balance":"Unbestätigtes Guthaben","Value Out":"Wert","Version":"Version","Waiting for blocks...":"Warte auf Blöcke...","Waiting for transactions...":"Warte auf Transaktionen...","by date.":"nach Datum.","first seen at":"zuerst gesehen am","mined":"gefunden","mined on:":"vom:","Waiting for blocks":"Warte auf Blöcke"});
    gettextCatalog.setStrings('es', {"(Input unconfirmed)":"(Entrada sin confirmar)","404 Page not found :(":"404 Página no encontrada :(","<strong>insight</strong>  is an <a href=\"http://live.insight.is/\" target=\"_blank\">open-source Komodo blockchain explorer</a> with complete REST and websocket APIs that can be used for writing web wallets and other apps  that need more advanced blockchain queries than provided by komodod RPC.  Check out the <a href=\"https://github.com/supernetorg/insight-ui-komodo\" target=\"_blank\">source code</a>.":"<strong>insight</strong>  es un <a href=\"http://live.insight.is/\" target=\"_blank\">explorador de bloques de Komodo open-source</a> con un completo conjunto de REST y APIs de websockets que pueden ser usadas para escribir monederos de Komodos y otras aplicaciones que requieran consultar un explorador de bloques.  Obtén el código en <a href=\"http://github.com/bitpay/insight\" target=\"_blank\">el repositorio abierto de Github</a>.","<strong>insight</strong> is still in development, so be sure to report any bugs and provide feedback for improvement at our <a href=\"https://github.com/bitpay/insight/issues\" target=\"_blank\">github issue tracker</a>.":"<strong>insight</strong> esta en desarrollo aún, por ello agradecemos que nos reporten errores o sugerencias para mejorar el software. <a href=\"https://github.com/supernetorg/insight-ui-komodo/issues\" target=\"_blank\">Github issue tracker</a>.","About":"Acerca de","Address":"Dirección","Age":"Edad","Application Status":"Estado de la Aplicación","Best Block":"Mejor Bloque","Komodo node information":"Información del nodo Komodo","Block":"Bloque","Block Reward":"Bloque Recompensa","Blocks":"Bloques","Bytes Serialized":"Bytes Serializados","Can't connect to komodod to get live updates from the p2p network. (Tried connecting to komodod at {{host}}:{{port}} and failed.)":"No se pudo conectar a komodod para obtener actualizaciones en vivo de la red p2p. (Se intentó conectar a komodod de {{host}}:{{port}} y falló.)","Can't connect to insight server. Attempting to reconnect...":"No se pudo conectar al servidor insight. Intentando re-conectar...","Can't connect to internet. Please, check your connection.":"No se pudo conectar a Internet. Por favor, verifique su conexión.","Complete":"Completado","Confirmations":"Confirmaciones","Conn":"Con","Connections to other nodes":"Conexiones a otros nodos","Current Blockchain Tip (insight)":"Actual Blockchain Tip (insight)","Current Sync Status":"Actual Estado de Sincronización","Details":"Detalles","Difficulty":"Dificultad","Double spent attempt detected. From tx:":"Intento de doble gasto detectado. De la transacción:","Error!":"¡Error!","Fee":"Tasa","Final Balance":"Balance Final","Finish Date":"Fecha Final","Go to home":"Volver al Inicio","Hash Serialized":"Hash Serializado","Height":"Altura","Included in Block":"Incluido en el Bloque","Incoherence in levelDB detected:":"Detectada una incoherencia en levelDB:","Info Errors":"Errores de Información","Initial Block Chain Height":"Altura de la Cadena en Bloque Inicial","Input":"Entrada","Last Block":"Último Bloque","Last Block Hash (Komodod)":"Último Bloque Hash (Komodod)","Latest Blocks":"Últimos Bloques","Latest Transactions":"Últimas Transacciones","Loading Address Information":"Cargando Información de la Dirección","Loading Block Information":"Cargando Información del Bloque","Loading Selected Date...":"Cargando Fecha Seleccionada...","Loading Transaction Details":"Cargando Detalles de la Transacción","Loading Transactions...":"Cargando Transacciones...","Loading...":"Cargando...","Mined Time":"Hora de Minado","Mined by":"Minado por","Mining Difficulty":"Dificultad de Minado","Next Block":"Próximo Bloque","No Inputs (Newly Generated Coins)":"Sin Entradas (Monedas Recién Generadas)","No blocks yet.":"No hay bloques aún.","No matching records found!":"¡No se encontraron registros coincidentes!","No. Transactions":"Nro. de Transacciones","Number Of Transactions":"Número de Transacciones","Output":"Salida","Powered by":"Funciona con","Previous Block":"Bloque Anterior","Protocol version":"Versión del protocolo","Proxy setting":"Opción de proxy","Received Time":"Hora de Recibido","Redirecting...":"Redireccionando...","Search for block, transaction or address":"Buscar bloques, transacciones o direcciones","See all blocks":"Ver todos los bloques","Show Transaction Output data":"Mostrar dato de Salida de la Transacción","Show all":"Mostrar todos","Show input":"Mostrar entrada","Show less":"Ver menos","Show more":"Ver más","Size":"Tamaño","Size (bytes)":"Tamaño (bytes)","Skipped Blocks (previously synced)":"Bloques Saltados (previamente sincronizado)","Start Date":"Fecha de Inicio","Status":"Estado","Summary":"Resumen","Summary <small>confirmed</small>":"Resumen <small>confirmados</small>","Sync Progress":"Proceso de Sincronización","Sync Status":"Estado de Sincronización","Sync Type":"Tipo de Sincronización","Synced Blocks":"Bloques Sincornizados","Testnet":"Red de prueba","There are no transactions involving this address.":"No hay transacciones para esta dirección","Time Offset":"Desplazamiento de hora","Timestamp":"Fecha y hora","Today":"Hoy","Total Amount":"Cantidad Total","Total Received":"Total Recibido","Total Sent":"Total Enviado","Transaction":"Transacción","Transaction Output Set Information":"Información del Conjunto de Salida de la Transacción","Transaction Outputs":"Salidas de la Transacción","Transactions":"Transacciones","Type":"Tipo","Unconfirmed":"Sin confirmar","Unconfirmed Transaction!":"¡Transacción sin confirmar!","Unconfirmed Txs Balance":"Balance sin confirmar","Value Out":"Valor de Salida","Version":"Versión","Waiting for blocks...":"Esperando bloques...","Waiting for transactions...":"Esperando transacciones...","by date.":"por fecha.","first seen at":"Visto a","mined":"minado","mined on:":"minado el:","Waiting for blocks":"Esperando bloques"});
    gettextCatalog.setStrings('ja', {"(Input unconfirmed)":"(入力は未検証です)","404 Page not found :(":"404 ページがみつかりません (´・ω・`)","<strong>insight</strong>  is an <a href=\"http://live.insight.is/\" target=\"_blank\">open-source Komodo blockchain explorer</a> with complete REST and websocket APIs that can be used for writing web wallets and other apps  that need more advanced blockchain queries than provided by komodod RPC.  Check out the <a href=\"https://github.com/supernetorg/insight-ui-komodo\" target=\"_blank\">source code</a>.":"<strong>insight</strong>は、komodod RPCの提供するものよりも詳細なブロックチェインへの問い合わせを必要とするウェブウォレットやその他のアプリを書くのに使える、完全なRESTおよびwebsocket APIを備えた<a href=\"http://live.insight.is/\" target=\"_blank\">オープンソースのビットコインブロックエクスプローラ</a>です。<a href=\"https://github.com/supernetorg/insight-ui-komodo\" target=\"_blank\">ソースコード</a>を確認","<strong>insight</strong> is still in development, so be sure to report any bugs and provide feedback for improvement at our <a href=\"https://github.com/bitpay/insight/issues\" target=\"_blank\">github issue tracker</a>.":"<strong>insight</strong>は現在開発中です。<a href=\"https://github.com/bitpay/insight/issues\" target=\"_blank\">githubのissueトラッカ</a>にてバグの報告や改善案の提案をお願いします。","About":"はじめに","Address":"アドレス","Age":"生成後経過時間","An error occured in the verification process.":"検証過程でエラーが発生しました。","An error occured:<br>{{error}}":"エラーが発生しました:<br>{{error}}","Application Status":"アプリケーションの状態","Best Block":"最良ブロック","Komodo comes with a way of signing arbitrary messages.":"Komodoには任意のメッセージを署名する昨日が備わっています。","Komodo node information":"Komodoノード情報","Block":"ブロック","Block Reward":"ブロック報酬","Blocks":"ブロック","Broadcast Raw Transaction":"生のトランザクションを配信","Bytes Serialized":"シリアライズ後の容量 (バイト)","Can't connect to komodod to get live updates from the p2p network. (Tried connecting to komodod at {{host}}:{{port}} and failed.)":"P2Pネットワークからライブ情報を取得するためにkomododへ接続することができませんでした。({{host}}:{{port}} への接続を試みましたが、失敗しました。)","Can't connect to insight server. Attempting to reconnect...":"insight サーバに接続できません。再接続しています...","Can't connect to internet. Please, check your connection.":"インターネットに接続できません。コネクションを確認してください。","Complete":"完了","Confirmations":"検証数","Conn":"接続数","Connections to other nodes":"他ノードへの接続","Current Blockchain Tip (insight)":"現在のブロックチェインのTip (insight)","Current Sync Status":"現在の同期状況","Details":"詳細","Difficulty":"難易度","Double spent attempt detected. From tx:":"二重支払い攻撃をこのトランザクションから検知しました：","Error message:":"エラーメッセージ:","Error!":"エラー！","Fee":"手数料","Final Balance":"最終残高","Finish Date":"終了日時","Go to home":"ホームへ","Hash Serialized":"シリアライズデータのハッシュ値","Height":"ブロック高","Included in Block":"取り込まれたブロック","Incoherence in levelDB detected:":"levelDBの破損を検知しました:","Info Errors":"エラー情報","Initial Block Chain Height":"起動時のブロック高","Input":"入力","Last Block":"直前のブロック","Last Block Hash (Komodod)":"直前のブロックのハッシュ値 (Komodod)","Latest Blocks":"最新のブロック","Latest Transactions":"最新のトランザクション","Loading Address Information":"アドレス情報を読み込んでいます","Loading Block Information":"ブロック情報を読み込んでいます","Loading Selected Date...":"選択されたデータを読み込んでいます...","Loading Transaction Details":"トランザクションの詳細を読み込んでいます","Loading Transactions...":"トランザクションを読み込んでいます...","Loading...":"ロード中...","Message":"メッセージ","Mined Time":"採掘時刻","Mined by":"採掘者","Mining Difficulty":"採掘難易度","Next Block":"次のブロック","No Inputs (Newly Generated Coins)":"入力なし (新しく生成されたコイン)","No blocks yet.":"ブロックはありません。","No matching records found!":"一致するレコードはありません！","No. Transactions":"トランザクション数","Number Of Transactions":"トランザクション数","Output":"出力","Powered by":"Powered by","Previous Block":"前のブロック","Protocol version":"プロトコルバージョン","Proxy setting":"プロキシ設定","Raw transaction data":"トランザクションの生データ","Raw transaction data must be a valid hexadecimal string.":"生のトランザクションデータは有効な16進数でなければいけません。","Received Time":"受信時刻","Redirecting...":"リダイレクトしています...","Search for block, transaction or address":"ブロック、トランザクション、アドレスを検索","See all blocks":"すべてのブロックをみる","Send transaction":"トランザクションを送信","Show Transaction Output data":"トランザクションの出力データをみる","Show all":"すべて表示","Show input":"入力を表示","Show less":"隠す","Show more":"表示する","Signature":"署名","Size":"サイズ","Size (bytes)":"サイズ (バイト)","Skipped Blocks (previously synced)":"スキップされたブロック (同期済み)","Start Date":"開始日時","Status":"ステータス","Summary":"概要","Summary <small>confirmed</small>":"サマリ <small>検証済み</small>","Sync Progress":"同期の進捗状況","Sync Status":"同期ステータス","Sync Type":"同期タイプ","Synced Blocks":"同期されたブロック数","Testnet":"テストネット","The message failed to verify.":"メッセージの検証に失敗しました。","The message is verifiably from {{verification.address}}.":"メッセージは{{verification.address}}により検証されました。","There are no transactions involving this address.":"このアドレスに対するトランザクションはありません。","This form can be used to broadcast a raw transaction in hex format over\n        the Komodo network.":"このフォームでは、16進数フォーマットの生のトランザクションをKomodoネットワーク上に配信することができます。","This form can be used to verify that a message comes from\n        a specific Komodo address.":"このフォームでは、メッセージが特定のKomodoアドレスから来たかどうかを検証することができます。","Time Offset":"時間オフセット","Timestamp":"タイムスタンプ","Today":"今日","Total Amount":"Komodo総量","Total Received":"総入金額","Total Sent":"総送金額","Transaction":"トランザクション","Transaction Output Set Information":"トランザクションの出力セット情報","Transaction Outputs":"トランザクションの出力","Transaction succesfully broadcast.<br>Transaction id: {{txid}}":"トランザクションの配信に成功しました。<br>トランザクションID: {{txid}}","Transactions":"トランザクション","Type":"タイプ","Unconfirmed":"未検証","Unconfirmed Transaction!":"未検証のトランザクションです！","Unconfirmed Txs Balance":"未検証トランザクションの残高","Value Out":"出力値","Verify":"検証","Verify signed message":"署名済みメッセージを検証","Version":"バージョン","Waiting for blocks...":"ブロックを待っています...","Waiting for transactions...":"トランザクションを待っています...","by date.":"日毎。","first seen at":"最初に発見された日時","mined":"採掘された","mined on:":"採掘日時:","(Mainchain)":"(メインチェーン)","(Orphaned)":"(孤立したブロック)","Bits":"Bits","Block #{{block.height}}":"ブロック #{{block.height}}","BlockHash":"ブロックのハッシュ値","Blocks <br> mined on:":"ブロック <br> 採掘日","Coinbase":"コインベース","Hash":"ハッシュ値","LockTime":"ロック時間","Merkle Root":"Merkleルート","Nonce":"Nonce","Ooops!":"おぉっと！","Output is spent":"出力は使用済みです","Output is unspent":"出力は未使用です","Scan":"スキャン","Show/Hide items details":"アイテムの詳細を表示または隠す","Waiting for blocks":"ブロックを待っています","by date. {{detail}} {{before}}":"日時順 {{detail}} {{before}}","scriptSig":"scriptSig","{{tx.confirmations}} Confirmations":"{{tx.confirmations}} 検証","<span class=\"glyphicon glyphicon-warning-sign\"></span> (Orphaned)":"<span class=\"glyphicon glyphicon-warning-sign\"></span> (孤立したブロック)","<span class=\"glyphicon glyphicon-warning-sign\"></span> Incoherence in levelDB detected: {{vin.dbError}}":"<span class=\"glyphicon glyphicon-warning-sign\"></span> Incoherence in levelDB detected: {{vin.dbError}}","Waiting for blocks <span class=\"loader-gif\"></span>":"ブロックを待っています <span class=\"loader-gif\"></span>"});
    gettextCatalog.setStrings('ru', {"(Input unconfirmed)":"(неподтвержденный вход)","404 Page not found :(":"404 Страница не найдена :(","<a href=\"https://komodoplatform.com\" target=\"_blank\" title=\"Komodo Platform\">Komodo Platform</a> strives to accelerate the adoption of blockchain technologies around the globe and to lead the world in blockchain integration. All of the Komodo’s unique and cutting-edge technologies are open-source and available to everyone.":"<a href=\"https://komodoplatform.com\" target=\"_blank\" title=\"Komodo Platform\">Komodo Platform</a> strives to accelerate the adoption of blockchain technologies around the globe and to lead the world in blockchain integration. All of the Komodo’s unique and cutting-edge technologies are open-source and available to everyone.","Address":"Адрес","Age":"Время","An error occured in the verification process.":"Произошла ошибка в процессе проверки.","An error occured:<br>{{error}}":"Произошла ошибка:<br>{{error}}","Application Status":"Статус приложения","Block":"Блок","Block Reward":"Награда за блок","Blocks":"Блоки","Broadcast Raw Transaction":"Отправить raw-транзакцию в сеть","Can't connect to insight server. Attempting to reconnect...":"Ошибка подклоючения к серверу insight. Повторная попытка...","Can't connect to internet. Please, check your connection.":"Ошибка подключения к интернет. Пожалуйста, проверьте соединение.","Can't connect to komodod to get live updates from the p2p network. (Tried connecting to komodod at {{host}}:{{port}} and failed.)":"Ошибка подключения к komodod для получения обновлений из сети. (Попытка подключения к {{host}}:{{port}} не удалась.)","Charts":"Графики","Complete":"Завершено","Confirmations":"Подтверждений","Conn":"Узлы","Connections to other nodes":"Соединений с другими узлами","Current Blockchain Tip (insight)":"Текущая вершина блокчейна (insight)","Current Sync Status":"Текущий статус синхронизации","Details":"Подробная информация","Difficulty":"Сложность","Double spent attempt detected. From tx:":"Попытка двойной траты. Транзакция:","End-to-end Blockchain Solutions Provider empowering developers to build freely\nand participate in creating the largest open blockchain network.":"End-to-end Blockchain Solutions Provider empowering developers to build freely\nand participate in creating the largest open blockchain network.","Error message:":"Описание ошибки:","Error!":"Ошибка!","Fee":"Комиссия","Fee Rate":"Размер комисии","Final Balance":"Итоговый баланс","Finish Date":"Время завершения","Go to home":"Домой","Height":"Высота","Included in Block":"Входит в блок","Incoherence in levelDB detected:":"Нарушение связности в LevelDB:","Info Errors":"Информация об ошибках","Initial Block Chain Height":"Начальная высота блокчейна","Input":"Вход","Komodo comes with a way of signing arbitrary messages.":"Komodo comes with a way of signing arbitrary messages.","Komodo node information":"Информация об узле","Last Block":"Последний блок","Last Block Hash (Komodod)":"Хеш последнего блока (komodod)","Latest Blocks":"Последние блоки","Latest Transactions":"Последние транзакции","Loading Address Information":"Загрузка информации\n об адресе","Loading Block Information":"Загрузка информации о блоке","Loading Selected Date...":"Загрузка выбранной даты...","Loading Transaction Details":"Загрузка деталей транзакции","Loading Transactions...":"Загрузка транзакций...","Loading chart...":"Загрузка графиков...","Loading...":"Загрузка...","Message":"Сообщение","Mined Time":"Время получения","Mined by":"Майнер","Mining Difficulty":"Сложность майнинга","Network":"Сеть","Next Block":"Следующий блок","No Inputs":"Нет входов","No Inputs (Newly Generated Coins)":"Нет входов (coinbase транзакция)","No JoinSplits":"Нет операций (sprout)","No Outputs":"Нет выходов","No Shielded Spends and Outputs":"Нет операций (sapling)","No blocks yet.":"Пока нет блоков.","No matching records found!":"Не найдено записей!","No. Transactions":"Всего транзакций","Number Of Transactions":"Количество транзакций","Output":"Выход","Powered by":"Powered by","Previous Block":"Предыдущий блок","Protocol version":"Версия протокола","Proxy setting":"Настройки proxy","Public input":"Публичный вход","Public output":"Публичный выход","Raw transaction data":"Raw данные транзакции","Raw transaction data must be a valid hexadecimal string.":"Raw данные транзакции должны быть правильной hex строкой.","Received Time":"Время получения","Redirecting...":"Перенаправление ...","Search for block, transaction or address":"Поиск блока, транзакции или адреса","See all blocks":"Просмотр всех блоков","Send transaction":"Отправить транзакцию","Show all":"Показать все","Show input":"Показать вход","Show less":"Скрыть","Show more":"Показать","Signature":"Подпись","Size":"Размер","Size (bytes)":"Размер (байт)","Skipped Blocks (previously synced)":"Пропущенные блоки (ранее синхронизированные)","Start Date":"Время начала","Status":"Статус","Summary":"Итог","Summary <small>confirmed</small>":"Итог <small>подтвержденный</small>","Sync Progress":"Синхронизация","Sync Status":"Статус синхронизации","Sync Type":"Тип синхронизации","Synced Blocks":"Синхронизировано блоков","The message failed to verify.":"Проверка подписи сообщения не пройдена.","The message is verifiably from {{verification.address}}.":"Сообщение подписано отправителем {{verification.address}}.","There are no transactions involving this address.":"Для этого адреса нет транзакций.","This form can be used to broadcast a raw transaction in hex format over\n        the Komodo network.":"Эта форма может быть использована для отправки raw транзакции в hex\n        формате через сеть.","This form can be used to verify that a message comes from\n        a specific Komodo address.":"Эта форма может быть использована для проверки\n        отправителя (адреса) сообщения.","Time Offset":"Смещение времени","Timestamp":"Дата / время","Today":"Сегодня","Total Received":"Всего получено","Total Sent":"Всего отправлено","Transaction":"Транзакция","Transaction succesfully broadcast.<br>Transaction id: {{txid}}":"Транзакция успешно отправлена.<br>TXID: {{txid}}","Transactions":"Транзакции","Type":"Тип","Unconfirmed":"Нет подтверждений","Unconfirmed Transaction!":"Неподтвержденная транзакция!","Unconfirmed Txs Balance":"Баланс неподтвержденных транзакций","Value Out":"Сумма","Verify":"Проверить","Verify signed message":"Проверить подпись сообщения","Version":"Версия","Waiting for blocks...":"Ожидание блоков...","Waiting for transactions...":"Ожидание транзакций...","What is Komodo?":"What is Komodo?","by date.":"по дате.","first seen at":"первое появление","mined":"дата","mined on:":"дата:"});
/* jshint +W100 */
}]);