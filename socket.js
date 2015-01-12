/*
 * @license
 * angular-socket-io v0.7.0
 * (c) 2014 Brian Ford http://briantford.com
 * License: MIT
 */

angular.module('btford.socket-io', []).
  provider('socketFactory', function () {

    'use strict';

    // when forwarding events, prefix the event name
    var defaultPrefix = 'socket:';

    // expose to provider
    this.$get = ['$rootScope', '$timeout', function ($rootScope, $timeout) {

      return function socketFactory(options) {
        options = options || {};
        var prefix = options.prefix === undefined ? defaultPrefix : options.prefix ;
        var defaultScope = options.scope || $rootScope;

        var socket;

        // if socket is not connected, we queue up calls from controllers
        // and re-execute later
        var queue = {
          addListener: [],
          addOnceListener: [],
          forward: [],
          emit: []
        };

        function asyncAngularify(socket, callback) {
          return callback ? function () {
            var args = arguments;
            $timeout(function () {
              callback.apply(socket, args);
            }, 0);
          } : angular.noop;
        }

        // this is a wrapper around base functionality we do the the socket.io client but we always require
        // the caller to pass the instance into us.  the onus is on the caller to ensure that the socket
        // client is in a good state / connected.
        var io = {
          emit: function (socket, eventName, data, callback) {
            if (!socket || !socket.connected) { throw new Error('emit called and socket not ready'); }
            if (typeof callback === 'function') {
              callback = asyncAngularify(socket, callback);
            }
            return socket.emit.call(socket, eventName, data, callback);
          },

          forward: function (socket, events, scope, prefix) {
            if (!socket || !socket.connected) { throw new Error('forward called and socket not ready'); }
            events.forEach(function (eventName) {
              var prefixedEvent = prefix + eventName;
              var forwardBroadcast = asyncAngularify(socket, function () {
                Array.prototype.unshift.call(arguments, prefixedEvent);
                scope.$broadcast.apply(scope, arguments);
              });

              scope.$on('$destroy', function () {
                socket.removeListener(eventName, forwardBroadcast);
              });

              return socket.on(eventName, forwardBroadcast);
            });
          },

          addListener: function (socket, eventName, callback) {
            if (!socket || !socket.connected) { throw new Error('addListener called and socket not ready'); }
            return socket.on(eventName, callback.__ng = asyncAngularify(socket, callback));
          },

          addOnceListener: function (socket, eventName, callback) {
            if (!socket || !socket.connected) { throw new Error('addOnceListener called and socket not ready'); }
            return socket.once(eventName, callback.__ng = asyncAngularify(socket, callback));
          }
        };

        /*jshint unused: false */
        var emit = function (eventName, data, callback) {
          var array = Array.prototype.slice.apply(arguments);
          if (!socket || !socket.connected) {
            queue.emit.push(array);
          } else {
            array.unshift(socket);
            io.emit.apply(null, array);
          }
        };

        /*jshint unused: false */
        var forward = function (events, scope) {
          if (!scope) { scope = defaultScope; }
          if (events instanceof Array === false) { events = [events]; }
          var array = [events, scope, prefix];
          if (!socket || !socket.connected) {
            queue.forward.push(array);
          } else {
            array.unshift(socket);
            io.forward.apply(null, array);
          }
        };

        /*jshint unused: false */
        var addListener = function (eventName, callback) {
          var array = Array.prototype.slice.call(arguments);
          if (!socket || !socket.connected) {
            queue.addListener.push(array);
          } else {
            array.unshift(socket);
            io.addListener.apply(null, array);
          }
        };

        // /*jshint unused: false */
        var addOnceListener = function (eventName, callback) {
          var array = Array.prototype.slice.call(arguments);
          if (!socket || !socket.connected) {
            queue.addOnceListener.push(array);
          } else {
            array.unshift(socket);
            io.addOnceListener.apply(null, array);
          }
        };

        var removeListener = function (ev, fn) {
          if (fn && fn.__ng) {
            arguments[1] = fn.__ng;
          }
          return socket.removeListener.apply(socket, arguments);
        };

        var removeAllListeners = function () {
          return socket.removeAllListeners.apply(socket, arguments);
        };

        return {
          emit: emit,
          forward: forward,
          on: addListener,
          addListener: addListener,
          once: addOnceListener,
          removeListener: removeListener,
          removeAllListeners: removeAllListeners,
          socket: function (s) {
            socket = s;
            for (var key in queue) {
              var deferredCalls = queue[key];
              if (deferredCalls.length > 0) {
                console.log('%s has %d deferred calls b/c socket was not ready yet', key, deferredCalls.length);
                deferredCalls.map(function (array) {
                  array.unshift(socket);
                  io[key].apply(null, array);
                });
                queue[key].length = 0;
              }
            }
          }
        }; // end return

      }; // end socketFactory

    }];  // end .$get
  }); // end provider
