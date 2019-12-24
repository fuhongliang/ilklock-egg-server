'use strict';

const assert = require('assert');
const BizError = require('../model/error');

module.exports = () => {
  return async function errorHandler(ctx, next) {
    ctx.set('content-type', 'application/json; charset=utf-8');

    // const start = Date.now();
    try {
      await next();
      if (ctx.status === 200) {
        ctx.body = {
          code: 0,
          msg: 'success',
          data: ctx.helper.datetimeString(ctx.body),
        };
      }
    } catch (err) {
      let errorMsg;
      const status = err.status || 500;
      const code = parseInt(err.code) || status;

      if (err.constructor !== BizError && err.constructor !== assert.AssertionError) { // 自己系统的错误不记录
        // 所有的异常都在 app 上触发一个 error 事件，框架会记录一条错误日志
        ctx.app.emit('error', err, ctx);
        errorMsg = 'Internal Server Error';
      } else {
        if (ctx.app.config.env !== 'prod') ctx.app.emit('error', err, ctx);
        errorMsg = err.message;
      }


      // 生产环境时 500 错误的详细错误内容不返回给客户端，因为可能包含敏感信息
      // const error = status === 500 && ctx.app.config.env === 'prod' && err.constructor !== BizError ? 'Internal Server Error' : err.message;

      // 从 error 对象上读出各个属性，设置到响应中
      ctx.body = {
        code,
        data: err.data,
        msg: errorMsg,
      };
      ctx.status = status;
    } finally {
      // ctx.logger.debug('request time for path `%s`: %sms', ctx.path, (Date.now() - start));
    }
  };
};
