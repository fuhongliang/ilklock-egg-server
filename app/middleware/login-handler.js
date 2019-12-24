'use strict';

const BizError = require('../model/error');

function keepLoginFlag(ctx) {
  if (ctx.session.user) {
    ctx.cookies.set('LoginFlag', 'true', {
      httpOnly: false,
      maxAge: 2 * 3600 * 1000,
      signed: false,
    });
  }
}

module.exports = () => {
  return async function loginHandler(ctx, next) {
    const pathGroup = ctx.path.split('/');
    if (pathGroup.length < 5) {
      ctx.status = 404;
      ctx.body = '{}';
      return;
    }
    // const apiVersion = pathGroup[2];
    const mainModule = pathGroup[3];

    // 登录相关的api不需要登录校验
    if (mainModule === 'login') {
      await next();
      keepLoginFlag(ctx);
      return;
    }

    if (mainModule === 'sdk') {
      return await next();
    }

    if (!ctx.session.user) {
      throw new BizError('Not Login!', 401);
    }

    // 权限&公司
    // if (!ctx.session.company) {
    //   throw new BizError('Please select company.', 500);
    // }
    // ctx.permissions = await ctx.service.role.loginUserPermission();
    // const canAccess = ctx.service.permission.hasPermission(modulePath, ctx.permissions);
    // if (!canAccess) {
    //   throw new BizError('Permission Denied!', 403);
    // }

    await next();
    keepLoginFlag(ctx);

    // 记录系统日志
    try {
      if (mainModule === 'sdk') {
        await ctx.service.sysLog.log(0, ctx.body);
      } else if (ctx.request.method !== 'GET') {
        const id = ctx.request.body.id || ctx.body.insertId || ctx.body.id || 0;
        await ctx.service.sysLog.log(id, '');
      }
    } catch (e) {
      ctx.logger.error(e);
    }
  };
};
