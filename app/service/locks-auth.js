'use strict';

const assert = require('assert');
const moment = require('moment');
const Service = require('egg').Service;

class LocksAuthService extends Service {
  async applyAuth(data) {
    const { tables } = this.config;
    const { arrayQuery } = this.ctx.helper;
    const company = this.ctx.session.company;
    const userId = this.ctx.session.user.id;

    let targets = data.targets;
    let rows;
    let rowsIdSet;
    switch (data.type) {
      case 1:
        targets = Array.from(new Set(targets));
        assert(targets.length > 0, '请选择授权区域');
        rows = await this.ctx.app.mysql.query(
          `select id from ${tables.companyArea} where id in (${arrayQuery(targets)}) and company = ? and is_deleted = 0`,
          [ ...targets, company ]
        );
        data.targets = rows.map(i => i.id);
        break;
      case 2:
      case 3:
        assert(targets.length > 0, '请选择需要授权的锁');
        rows = await this.ctx.app.mysql.query(
          `select lock_id from ${tables.locks} where lock_id in (${arrayQuery(targets)}) and company = ? and is_deleted = 0`,
          [ ...targets, company ]
        );
        rowsIdSet = new Set(rows.map(i => i.lock_id));
        assert(targets.every(i => rowsIdSet.has(i)), '锁信息有误');
        if (data.type === 2) {
          data.targets = Array.from(new Set(targets));
        }
        break;
      default:
        throw new Error('请选择授权类型');
    }

    let expireTime;
    let timeRange;
    switch (data.validType) {
      case 1: // 临时有效
        expireTime = moment(data.validTime, 'YYYY-MM-DD HH:mm:ss');
        this.ctx.logger.info(expireTime - moment());
        if (expireTime - moment() <= 60000) {
          throw new Error('请选择失效时间');
        }

        data.validTime = expireTime.format('YYYY-MM-DD HH:mm:ss');
        break;
      case 2: // 时间段有效
        timeRange = JSON.parse(data.validTime);
        assert(timeRange.weekday >= 1 && timeRange.weekday <= 7, '');
        assert(/^\d{2}:\d{2}:\d{2}$/.test(timeRange.timeBegin));
        assert(/^\d{2}:\d{2}:\d{2}$/.test(timeRange.timeEnd));

        timeRange = {
          weekday: timeRange.weekday,
          timeBegin: timeRange.timeBegin,
          timeEnd: timeRange.timeEnd,
        };
        data.validTime = JSON.stringify(timeRange);
        break;
      case 3: // 长期有效
        data.validTime = '';
        break;
      default:
        throw new Error('请选择有效时间段');
    }

    return await this.app.mysql.insert(tables.locksAuth, {
      company,
      user: userId,
      type: data.type,
      valid_type: data.validType,
      valid_time: data.validTime,
      status: 0,
      targets: data.targets.join(','),
      reviewer: 0,
      create_at: new Date(),
      update_at: new Date(),
    });
  }

  async reviewPass(authId, result) {
    const { tables } = this.config;
    const company = this.ctx.session.company;
    const userId = this.ctx.session.user.id;

    const row = await this.app.mysql.queryOne(
      `select id from ${tables.locksAuth} where id = ?`, [ authId ]
    );

    assert(row, '该审批单不存在');
    const status = result ? 10 : 99;

    return await this.app.mysql.query(
      `update ${tables.locksAuth} set status = ?,reviewer = ?,update_at = ? where id = ? and company = ? and is_deleted = 0`,
      [ status, userId, new Date(), authId, company ]
    );
  }

  async search(conditions) {
    const { tables } = this.config;
    const { underlineToCamel } = this.ctx.helper;
    const company = this.ctx.session.company;
    const userId = this.ctx.session.user.id;

    const status = conditions.status || [ -1, 0, 1, 2, 3, 4, 5, 10, 11, 99 ];
    const query = [ 'company = ?', 'is_deleted = 0', 'status in (?)' ];
    const params = [ company, status ];
    if (conditions.my) {
      query.push('user = ?');
      params.push(userId);
    }

    const rows = await this.app.mysql.query(
      `select * from ${tables.locksAuth} where ${query.join(' and ')}`, params
    );
    underlineToCamel(rows);

    return rows;
  }
}

module.exports = LocksAuthService;
