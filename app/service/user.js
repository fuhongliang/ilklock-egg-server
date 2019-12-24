/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const assert = require('assert');
const sha256 = require('hash.js/lib/hash/sha/256');
const BizError = require('../model/error');
const Pinyin = require('pinyin');
const Service = require('egg').Service;

class UserService extends Service {
  async findById(id) {
    const { tables } = this.config;
    const user = await this.app.mysql.queryOne(`select * from ${tables.user} where id = ? `, id);
    return user;
  }

  async search(name, mobile) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const additionQuery = [ '' ];
    const params = [ company ];
    if (name) {
      additionQuery.push('u.realname like concat("%", ?, "%")');
      params.push(name);
    }

    if (mobile) {
      additionQuery.push('u.mobile like concat(?, "%")');
      params.push(mobile);
    }
    const users = await this.ctx.helper.paginator(
      `select u.id,u.realname,u.mobile,u.email,u.wxid,u.last_login from ${tables.userCompany} uc inner join ${tables.user} u on uc.user = u.id where uc.company = ? ${additionQuery.join(' and ')} order by u.id`,
      params
    );

    return users;
  }

  async findByMobile(mobile) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const user = await this.app.mysql.queryOne(
      `select u.id,u.realname,u.mobile,u.email,u.wxid,u.last_login from ${tables.userCompany} uc left join ${tables.user} u on uc.user = u.id where uc.company = ? and u.mobile = ? order by u.id`,
      [ company, mobile ]);
    return this.ctx.helper.underlineToCamel(user);
  }


  async findCompanyByUser(userId) {
    const companys = await this.service.company.findByUser(userId);

    if (companys.length === 0) {
      throw new BizError('抱歉，您没有归属公司', 400);
    }
    // TODO
    // if (companys.length === 1) {
    this.ctx.session.company = companys[0].id;
    // } else {
    //   throw new BizError('请选择您所在的公司', 200, 30102, companys);
    // }
  }

  async updatePasswd(oldPwd, newPwd) {
    const { tables } = this.config;

    const userId = this.ctx.session.user.id;

    const user = await this.app.mysql.queryOne(`select password,pwd_salt from ${tables.user} where id = ?`, [ userId ]);
    this.ctx.helper.underlineToCamel(user);

    if (user) {
      const oldPwdHash = sha256().update(oldPwd + user.pwdSalt).digest('hex');
      if (!user.password || user.password === oldPwdHash) {
        const newSalt = this.generateSalt();
        const newPwdHash = sha256().update(newPwd + newSalt).digest('hex');
        const results = await this.app.mysql.query(
          `update ${tables.user} set password = ?, pwd_salt = ? where id = ?`,
          [ newPwdHash, newSalt, userId ]);

        return results;
      }
    }

    throw new BizError('password error.');
  }

  async bindMobileByWxid(mobile) {
    const { tables } = this.config;
    const wxid = this.ctx.session.user.wxid;

    if (!wxid) throw new BizError('绑定失败');

    const user = await this.app.mysql.queryOne(`select mobile, wxid from ${tables.user} where mobile = ?`, [ mobile ]);
    if (!user) {
      throw new BizError('用户不存在');
    }

    if (user.wxid) throw new Error('绑定失败');

    const results = await this.app.mysql.query(
      `update ${tables.user} set mobile = ?, update_at = ? where id = ?`,
      [ mobile, new Date(), user.id ]);
    return results;
  }

  async delete(userId) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    await this.app.mysql.delete(tables.userCompany, {
      company,
      user: userId,
    });
  }

  /**
   * 导入用户
   * @param {*} users 用户列表，格式： [{mobile, realname}]
   */
  async importUser(users) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const mobileUserMap = new Map();
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.mobile) {
        mobileUserMap.set(user.mobile, user);
      }
    }

    assert(mobileUserMap.size > 0, new BizError('Failed to detect mobile phone number.'));

    const checkUserExist = await this.app.mysql.query(
      `select id,mobile,realname from ${tables.user} where mobile in (${Array(mobileUserMap.size).fill('?').join(',')})`,
      [ ...mobileUserMap.keys() ]
    );

    // 处理已经存在的用户
    const existUserIds = new Set();
    for (let i = 0; i < checkUserExist.length; i++) {
      const row = checkUserExist[i];
      existUserIds.add(row.id);
      mobileUserMap.delete(row.mobile);
    }

    // 添加公司关联关系
    if (existUserIds.size > 0) {
      const checkCompanyExist = await this.app.mysql.query(
        `select id,user,company from ${tables.userCompany} where company = ? and user in (${Array(existUserIds.size).fill('?').join(',')})`,
        [ company, ...existUserIds ]
      );

      for (let i = 0; i < checkCompanyExist.length; i++) {
        const uc = checkCompanyExist[i];
        if (existUserIds.has(uc.user)) {
          existUserIds.delete(uc.user);
        }
      }

      await this.bindCompany(Array.from(existUserIds));
    }

    if (mobileUserMap.size > 0) {
      const importedUsers = [ ...mobileUserMap.values() ].map(i => {
        return {
          mobile: i.mobile,
          realname: i.realname || '',
          pinyin: this.toPinyin(i.realname),
          email: '',
          password: '',
          pwd_salt: '',
          wxid: '',
          create_at: new Date(),
          update_at: new Date(),
        };
      });
      const results = await this.app.mysql.insert(tables.user, importedUsers);

      // 填充id
      importedUsers.forEach((u, i) => {
        u.id = results.insertId + i;
      });

      // 插入公司对应关系
      await this.bindCompany(importedUsers.map(i => i.id));
    }

  }

  async bindCompany(userIds) {
    assert(Array.isArray(userIds));
    if (userIds.length === 0) return;

    const { tables } = this.config;
    const company = this.ctx.session.company;

    // 插入公司对应关系
    await this.app.mysql.insert(tables.userCompany, userIds.map(i => {
      return {
        company,
        user: i,
        create_at: new Date(),
      };
    }));
  }

  async insertUser(user) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    assert(user.realname, '`realname` cannot be null.');
    assert(user.password, '`password` cannot be null.');
    assert(!/^\d+$/.test(user.password), '`password` is too simple.');
    assert(user.password.length >= 8, '`password` must longer then 8 chars.');
    assert(user.mobile, '`mobile` cannot be null.');
    assert(/^1[0-9]{10}$/.test(user.mobile), '`mobile` illegle.');

    const userExist = await this.app.mysql.queryOne(`select id from ${tables.user} where mobile = ?`, [ user.mobile ]);
    if (userExist) {
      const companyRelation = await this.app.mysql.queryOne(`select id from ${tables.userCompany} where user = ? and company = ?`, [ user.id, company ]);
      assert(!companyRelation, 'user exist.');

      return await this.bindCompany([ userExist.id ]);
    }

    user.id = null;
    user.pwd_salt = this.generateSalt();
    user.password = sha256().update(user.password + user.pwd_salt).digest('hex');
    user.pinyin = user.pinyin || this.toPinyin(user.realname);
    user.email = user.email || '';
    user.wxid = user.wxid || '';
    user.create_at = new Date();
    user.update_at = new Date();

    await this.app.mysql.insert(tables.user, user);
    await this.bindCompany([ user.id ]);
  }

  async updateSelf(user) {
    const { tables } = this.config;
    const userId = this.ctx.session.user.id;

    user.pinyin = user.pinyin || this.toPinyin(user.realname);
    user.email = user.email || '';
    user.update_at = new Date();

    const results = await this.app.mysql.query(
      `update ${tables.user} set realname = ?, pinyin = ?, email = ?, update_at = ? where id = ?`, [
        user.realname,
        user.pinyin,
        user.email,
        user.update_at,
        userId,
      ]);
    return results;
  }

  async updateInfo(user) {
    const { tables } = this.config;

    const results = await this.app.mysql.query(`update ${tables.user} set realname = ?, email = ?, update_at = ? where id = ?`, [
      user.realname,
      user.email,
      user.id,
    ]);
    return results;
  }

  async personalInfo() {
    const { tables } = this.config;
    const company = this.ctx.session.company;
    const userId = this.ctx.session.user.id;

    const userInfo = await this.app.mysql.query(
      `select realname,mobile,email,pinyin,last_login,c.name as company_name from ${tables.userCompany} uc 
        left join ${tables.user} u on uc.user = u.id 
        left join ${tables.company} c on uc.company = c.id
      where uc.user = ? and uc.company = ?`,
      [ userId, company ]);

    return this.ctx.helper.underlineToCamel(userInfo);
  }

  generateSalt(length = 8) {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const salt = [];
    for (let i = 0; i < length; i++) {
      salt.push(letters[Math.floor(Math.random() * letters.length)]);
    }

    return salt.join('');
  }

  toPinyin(name) {
    const pinyin = Pinyin(name || '', {
      style: Pinyin.STYLE_NORMAL, // 设置拼音风格
    }).join('');

    return pinyin;
  }
}

module.exports = UserService;
