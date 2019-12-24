/** *
 *
 * @author steephenliu
 * @date 2019-04-01
**/

'use strict';


const assert = require('assert');
const Service = require('egg').Service;
const LockTypeSet = new Set([ 1 ]);

class LocksService extends Service {
  async findByLockId(lockId) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const lock = await this.app.mysql.queryOne(
      `select * from ${tables.locks} where lock_id = ? and company = ? and is_deleted = 0`,
      [ lockId, company ]);
    return this.ctx.helper.underlineToCamel(lock);
  }

  async findByArea(area) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const locks = await this.app.mysql.query(
      `select * from ${tables.locks} where area = ? and company = ? and is_deleted = 0`,
      [ area, company ]);

    return this.ctx.helper.underlineToCamel(locks);
  }

  async findByCompany() {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const locks = await this.app.mysql.query(
      `select * from ${tables.locks} where company = ? and is_deleted = 0 order by area`,
      [ company ]);

    return this.ctx.helper.underlineToCamel(locks);
  }

  async checkIdExist(ids) {
    const { tables } = this.config;

    const existIds = await this.app.mysql.query(`select lock_id from ${tables.locks} where lock_id in (${Array(ids.length).fill('?')})`, ids);
    const existIdSet = new Set(existIds.map(r => r.lock_id));

    return ids.filter(i => !existIdSet.has(i));
  }

  async initLock(lockId) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const password = Math.floor(Math.random() * 2000000000);
    if (!lockId) {
      let lockIds = await this.checkIdExist(Array(5).fill(0).map(() => Math.floor(Math.random() * 2000000000)));
      while (lockIds.length === 0) {
        lockIds = await this.checkIdExist(Array(5).fill(0).map(() => Math.floor(Math.random() * 2000000000)));
      }

      lockId = lockIds[0];
      const lockInfo = {
        company,
        name: '',
        code: '',
        lock_id: lockId,
        type: 1,
        pwd: password,
        soft_status: 0,
        sensor_status: 0,
        area: 0,
        create_at: new Date(),
        update_at: new Date(),
      };

      const results = await this.app.mysql.insert(tables.locks, lockInfo);
      assert(results.affectedRows, 'DB error!');

    } else {
      const row = await this.app.mysql.queryOne(`select id,lock_id,company from ${tables.locks} where lock_id = ?`, [ lockId ]);
      assert(row, 'Init error!');
      assert(row.company === company, 'Init Error!');

      const results = await this.app.mysql.update(tables.locks, {
        company,
        name: '',
        code: '',
        type: 1,
        pwd: password,
        soft_status: 0,
        sensor_status: 0,
        area: 0,
        update_at: new Date(),
        is_deleted: 0,
      }, {
        where: {
          id: row.id,
        },
      });

      assert(results.affectedRows, 'DB error!');
    }

    return {
      lockId,
      password,
    };
  }

  async update(lock) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    assert(lock.id, 'Lock `id` cannot be null.');
    assert(LockTypeSet.has(lock.type), 'Please select lock `type`.');
    if (lock.area) {
      const area = await this.service.companyArea.findById(lock.area);
      assert(area, 'Area doesn\'t exist.');
    } else {
      lock.area = 0;
    }

    lock.name = lock.name || '';
    lock.code = lock.code || '';
    lock.update_at = new Date();

    const results = await this.app.mysql.query(
      `update ${tables.locks} set name = ?, code = ?, type = ?, area = ?, update_at = ? where id = ? and company = ? and is_deleted = 0`,
      [ lock.name, lock.code, lock.type, lock.area, lock.update_at, lock.id, company ]
    );

    return results;
  }

  async updateStatus(lockId, softStatus, sensorStatus) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    assert(lockId, '`lockId` is null');
    softStatus = parseInt(softStatus, 10);
    sensorStatus = parseInt(sensorStatus, 10);

    const results = await this.app.mysql.query(
      `update ${tables.locks} set soft_status = ?, sensor_status = ?, update_at = ? where lock_id = ? and company = ? and is_deleted = 0`,
      [ softStatus, sensorStatus, new Date(), lockId, company ]
    );

    return results;
  }

  async delete(lockId) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    await this.app.mysql.query(`update ${tables.locks} set is_deleted = 1 where lock_id = ? and company = ?`, [ lockId, company ]);
  }
}

module.exports = LocksService;
