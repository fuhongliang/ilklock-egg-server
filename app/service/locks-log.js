/* eslint-disable no-bitwise */
/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const assert = require('assert');
const Service = require('egg').Service;


class LocksLogService extends Service {
  logCodeMap() {}
  readInt(buf, bitOffset, length) {
    let readOffset = bitOffset;
    let result = 0;
    for (let i = 0; i < length; i++) {
      const bytePos = Math.floor(readOffset / 8);
      const bitPos = 7 - (readOffset % 8);
      const byte = buf.readUInt8(bytePos);
      const bit = (byte >> bitPos) & 1;

      result |= bit << (length - i - 1);
      readOffset++;
    }

    return result;
  }
  decrypt(data) {
    assert(data instanceof Buffer, 'Error');

    const logVersion = this.readInt(data, 0, 4);
    const logTime = this.readInt(data, 4, 32);
    const logOrder = this.readInt(data, 36, 16);
    const keyStatus = this.readInt(data, 52, 8);
    const logCode = this.readInt(data, 60, 8);
    const user = this.readInt(data, 68, 32);
    const company = this.readInt(data, 100, 32);
    const userAddition = this.readInt(data, 132, 32);
    const locks = this.readInt(data, 164, 32);
    const softStatus = this.readInt(data, 196, 4);
    const sensorStatue = this.readInt(data, 200, 16);

    return {
      logVersion,
      logTime,
      logOrder,
      keyStatus,
      logCode,
      user,
      company,
      userAddition,
      locks,
      softStatus,
      sensorStatue,
    };
  }

  async linkForeignKey(rows, table, idColumn, targetColumns) {
    if (rows.length === 0) return;
    if (targetColumns.length === 0) return;

    const ids = Array.from(new Set(rows.map(r => r[idColumn])));
    const foreignTable = await this.app.mysql.query(`select id,${targetColumns.join(',')} from ${table} where id in (${this.ctx.helper.arrayQuery(ids.length)})`, ids);
    this.ctx.helper.underlineToCamel(foreignTable);

    const idRows = foreignTable.reduce((pre, cur) => {
      pre.set(cur.id, cur);
      return pre;
    }, new Map());

    rows.forEach(r => {
      if (idRows.has(r[idColumn])) {
        targetColumns.forEach(col => {
          r[idColumn + col.replace(/^\w/, $0 => $0.toUpperCase())] = idRows.get(r[idColumn])[col];
        });
      } else {
        targetColumns.forEach(col => {
          r[idColumn + col.replace(/^\w/, $0 => $0.toUpperCase())] = '[未知]';
        });
      }
    });
  }

  /**
   *
   * @param {object} query 查询参数
   */
  async searchLog(query = {}) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const condition = [ 'company = ?' ];
    const params = [ company ];

    if (query.user) {
      condition.push('user = ?');
      params.push(query.user);
    }
    if (query.locks) {
      condition.push('locks = ?');
      params.push(query.locks);
    }
    if (query.logCode) {
      condition.push('log_code = ?');
      params.push(query.logCode);
    }

    const sql = `select * from ${tables.locksLog} where ${condition.join(' and ')} order by log_time,user,log_order`;
    const rows = await this.ctx.helper.paginator(sql, params);

    await this.linkForeignKey(rows.rows, tables.user, 'user', [ 'realname' ]);

    return rows;
  }

  /**
   * 插入一条日志
   * @param {Number} keyId 钥匙ID
   * @param {Buffer} ciperLog 加密后的串
   */
  async insertLogs(keyId, ciperLog) {
    const { tables } = this.config;

    const logData = this.decrypt(ciperLog);

    const results = await this.app.mysql.insert(tables.locksLog, {
      key_id: keyId,
      key_status: logData.keyStatus,
      log_time: logData.logTime,
      log_version: logData.logVersion,
      log_order: logData.logOrder,
      log_code: logData.logCode,
      user: logData.user,
      company: logData.company,
      user_addition: logData.userAddition,
      locks: logData.locks,
      soft_status: logData.softStatus,
      sensor_status: logData.sensorStatue,
      create_at: new Date(),
    });

    return results;
  }
}

module.exports = LocksLogService;
