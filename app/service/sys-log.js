'use strict';

const Service = require('egg').Service;

class SysLogService extends Service {
  async log(targetId, msg) {
    const company = this.ctx.session.company || 0;
    const userId = this.ctx.session.user.id || 0;
    const row = {
      company,
      user: userId,
      path: this.ctx.path,
      target_id: targetId,
      msg,
      create_at: new Date(),
    };

    this.app.runInBackground(async ctx => {
      const { tables } = ctx.app.config;

      await ctx.app.mysql.insert(tables.log, row);
    });
  }
}

module.exports = SysLogService;
