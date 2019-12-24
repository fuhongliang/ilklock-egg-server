'use strict';

const Service = require('egg').Service;
const BizError = require('../model/error');
const sha256 = require('hash.js/lib/hash/sha/256');

class LoginService extends Service {

  async loginByPwd(mobile, password) {
    const { tables } = this.config;

    const user = await this.app.mysql.queryOne(`select id,realname,password,mobile,pwd_salt from ${tables.user} where mobile = ?`, [ mobile ]);
    this.ctx.helper.underlineToCamel(user);
    if (!user) throw new BizError('登录失败', 401);

    const pwdHash = sha256().update(password + user.pwdSalt).digest('hex');
    if (user.password !== pwdHash) throw new BizError('登录失败', 401);

    return await this.loginSuccess(user);
  }

  async loginByWxid(code) {
    const { tables } = this.config;

    const { wechatSecret } = this.config;
    const res = await this.app.curl('https://api.weixin.qq.com/sns/jscode2session', {
      dataType: 'json',
      method: 'GET',
      data: {
        appid: wechatSecret.appId,
        secret: wechatSecret.appSecret,
        js_code: code,
        grant_type: 'authorization_code',
      },
    });

    const data = res.data;
    if (data.errcode) throw new BizError(data.errmsg);

    // res.openid,res.session_key,res.unionid,res.errcode,res.errmsg

    this.logger.info(res.data.openid);
    // const user = await this.app.mysql.queryOne(`select id,realname,mobile from ${tables.user} where wxid = ?`, [
    //   res.data.openid,
    // ]);
    // if (user) {
    //   return await this.loginSuccess(user);
    // }

    this.ctx.session.user = {
      wxid: res.data.openid,
      id: Math.floor(Math.random() * 100000000),
    };
    this.ctx.session.company = Math.floor(Math.random() * 100000000);
    throw new BizError('请绑定手机号', 200, 30101);
  }

  async sendMobileVerifyCode(mobile) {
    const { tables } = this.config;

    if (!mobile) throw new BizError('手机号不存在，请联系管理员添加', 200, 30103);

    const user = await this.app.mysql.queryOne(`select id,realname,mobile,wxid from ${tables.user} where mobile = ?`, [
      mobile,
    ]);

    if (!user) throw new BizError('手机号不存在，请联系管理员添加', 200, 30103);
    if (user.wxid) throw new BizError('该手机号已被绑定', 200, 30104);

    // send sms
    return { id: user.id };
  }

  async loginSuccess(user) {
    const { tables } = this.config;

    delete user.password;
    delete user.pwdSalt;
    this.ctx.session.user = user;

    // login success.
    const userId = user.id;
    this.app.runInBackground(async ctx => {
      await ctx.app.mysql.query(`update ${tables.user} set last_login = ? where id = ?`, [ new Date(), userId ]);
    });

    await this.service.user.findCompanyByUser(userId);
  }

}

module.exports = LoginService;
