'use strict';


/**
 * Apis.js controller
 *
 * @description: A set of functions called "actions" of the `apis` plugin.
 */


module.exports = {

  /**
   * Default action.
   *
   * @return {Object}
   */





  index: async (ctx, next) => {
    // Add your own logic here.


    if (ctx.state.user.role.name !== 'api') {
      // Go to next policy or will reach the controller's action.
      return await unauth();
    }

    // Send 200 `ok`
    ctx.send({
      message: 'ok'
    });
  },

  /**
   * Yatırılmak istenilen tutara göre uygun hesap bilgilerini döndüren fonksiyondur
   */
  getAvalibleAccount: async (ctx) => {

    if (ctx.state.user.role.name !== 'api') {
      return ctx.unauthorized(`You're not allowed to perform this action!`);
    }

    const qstring = ctx.request.query;

    if (
      !qstring.deposit
    ) {
      return ctx.send({
        statusCode: 400,
        message: 'bad request',
      });
    }

    const userDetail = await strapi.query('detail-user').model.query(qb => {
      qb.where('id', ctx.state.user.detail_user)
    }).fetch().then(userDetail => {
      return JSON.parse(JSON.stringify(userDetail));
    });

    // If unautherized any site
    if (userDetail.sitelers === undefined) {
      return ctx.unauthorized(`You're not allowed any site!`);
    }

    const result = await strapi
      .query('account', 'sites')
      .model
      .query(qb => {
        qb.whereRaw('?? < ??', ['procesCount', 'procesLimit'])
          .whereRaw('?? < ??', ['balance', 'balanceLimit'])
          .where("minDeposit", "<", qstring.deposit)
          .where("maxDeposit", ">", qstring.deposit)
          .where("balanceLimit", ">", qstring.deposit)
          .where('enable', "true")
      })
      .fetchAll(
        {withRelated: ['sites'], where: {'sites.id': userDetail.sitelers[0].id}},
      )
      .then(result => {

        const _result = JSON.parse(JSON.stringify(result));

        for (let item in _result) {
          for (let site in _result[item].sites) {
            for (let userSite in userDetail.sitelers) {
              if (_result[item].sites[site].id == userDetail.sitelers[userSite].id) {
                return {
                  'ID': _result[item].id,
                  'type': _result[item].type,
                  'name': _result[item].name,
                  'accountNo': _result[item].accountNo,
                  'site': _result[item].sites[site].id,
                  'displayName': _result[item].sites[site].displayName
                };
              }
            }
          }
        }
      });

    if (result === undefined) {
      return ctx.send({
        statusCode: 204,
        message: 'no content'
      });
    }

    ctx.send({
      statusCode: 200,
      message: 'ok',
      data: result
    });
  },

  /**
   * Yeni bir işlem oluşturulmasını sağlayan fonksiyondur
   */
  createTransaction: async (ctx) => {

    if (ctx.state.user.role.name !== 'api') {
      return ctx.unauthorized(`You're not allowed to perform this action!`);
    }

    let qstring = JSON.parse(JSON.stringify(ctx.request.body));

    if (
      !qstring.realName ||
      !qstring.balance ||
      !qstring.account ||
      !qstring.userName
    ) {
      return ctx.send({
        statusCode: 400,
        message: 'bad request',
      });
    }

    const userDetail = await strapi.query('detail-user').model.query(qb => {
      qb.where('id', ctx.state.user.detail_user)
    }).fetch().then(userDetail => {
      return JSON.parse(JSON.stringify(userDetail));
    });

    // If unautherized any site
    if (userDetail.sitelers === undefined) {
      return ctx.unauthorized(`You're not allowed any site!`);
    }


    const accountCheck = await strapi
      .query('account', 'sites')
      .model
      .query(qb => {
        qb.whereRaw('?? < ??', ['procesCount', 'procesLimit'])
          .whereRaw('?? < ??', ['balance', 'balanceLimit'])
          .where("minDeposit", "<", qstring.balance)
          .where("maxDeposit", ">", qstring.balance)
          .where("balanceLimit", ">", qstring.balance)
          .where('enable', "true")
      })
      .fetchAll(
        {withRelated: ['sites'], where: {'sites.id': userDetail.sitelers[0].id}},
      )
      .then(result => {

        const _result = JSON.parse(JSON.stringify(result));

        for (let item in _result) {
          for (let site in _result[item].sites) {
            for (let userSite in userDetail.sitelers) {
              if (_result[item].sites[site].id == userDetail.sitelers[userSite].id) {
                return {
                  'ID': _result[item].id,
                  'type': _result[item].type,
                  'name': _result[item].name,
                  'accountNo': _result[item].accountNo,
                  'site': _result[item].sites[site].id,
                  'displayName': _result[item].sites[site].displayName
                };

              }
            }
          }
        }
      });

    if (accountCheck !== undefined) {
      if (accountCheck.ID === qstring.account) {
        const result = await strapi.query('transaction').create({
          email: '',
          site: accountCheck.site,
          balance: qstring.balance,
          account: accountCheck.ID,
          userName: qstring.userName,
          Name: qstring.realName,
          incomingIp: ctx.request.ip,
          type: 'deposit',
          payment_type: 1,
          isadded: 0,
          transactionstatus: 3
        });


        return ctx.send({
          statusCode: 200,
          message: 'ok',
          data: {
            id: result.id
          }
        });
      } else {
        // yatırmak istediğiniz hesap uygun değil.
        return ctx.send({
          statusCode: 406,
          message: 'Account not eligible. Plesase check your account id and balance',
        });
      }
    } else {
      // uygun hesap bulunamadı
      return ctx.send({
        statusCode: 406,
        message: 'Account not eligible.',
      });

    }
  },

  /**
   * Daha önceden işlem yapılmış bir kayıdın bilgilerini getirir.
   */
  getTransactionDetail: async (ctx) => {

    if (ctx.state.user.role.name !== 'api') {
      return ctx.unauthorized(`You're not allowed to perform this action!`);
    }

    const qstring = ctx.request.query;

    const result = await strapi.query('transaction').model.query(qb => {
      qb.where('id', parseInt(qstring.trxID));
    })
      .fetch().then(response => {

        const _result = JSON.parse(JSON.stringify(response));  

        let account = null;
        if(_result.account !== null){
          account = _result.account.id;
        }

        return {
          "status": _result.transactionstatus.Name,
          "paymentType": _result.payment_type.Name,
          "added": _result.isadded,
          "balance": _result.balance,
          "account": account,
          "userName": _result.userName,
          "realName": _result.Name,
          "rejectReason": _result.declinereason
        }
      });

    ctx.send({
      statusCode: 200,
      message: 'ok',
      data: result
    });

  },

  /**
   * Durumu işleme kapatılmış işlemleri getirir.
   */
  getClosedTransaction: async (ctx) => {

    if (ctx.state.user.role.name !== 'api') {
      return ctx.unauthorized(`You're not allowed to perform this action!`);
    }

    const qstring = ctx.request.query;


    if (
      !qstring.page ||
      !qstring.limit ||
      !qstring.from ||
      !qstring.to ||
      !qstring.status
    ) {
      return ctx.send({
        statusCode: 400,
        message: 'bad request',
      });
    }


    let limit = Number(qstring.limit);
    let page = Number(qstring.page);

    if (limit > 50) {
      limit = 50;
    }

    if (page < 1) {
      page = 1;
    }
    

    const result = await strapi.query('transaction')
      .model
      .query(qb => {
        // qb.where("type", "withdraw")
        //   .where("transactionstatus", "in", "1")
        qb.where("created_at", "<=", qstring.to)
          .where("created_at", ">=", qstring.from)
          .limit(limit)
          .offset(limit * page)
          .orderBy('id', 'ASC')
      })
      .fetchAll().then(response => {

        const _response = JSON.parse(JSON.stringify(response));
        let data = new Array();

        for (const item in _response) {
        
          const account = (_response[item].account) ? _response[item].account.id : null;

          let status = null;
          if (_response[item].transactionstatus.Name === 'Onaylandı') {
            status = 'approved';
          } else if (_response[item].transactionstatus.Name === 'Reddedildi') {
            status = 'declined';
          } else if (_response[item].transactionstatus.Name === 'None') {
            status = 'pending';
          }

          data.push({
            "id": _response[item].id,
            "status": status,
            "paymentType": _response[item].payment_type.Name,
            "added": _response[item].isadded,
            "balance": _response[item].balance,
            "account": account,
            "userName": _response[item].userName,
            "realName": _response[item].Name,
            "created": _response[item].created_at,
          });

        }
        return data;

      });

    let data = new Array();
    for (const item in result) {
      data.push({
        "id": result[item].id,
        "balance": result[item].balance,
      })
    }

    ctx.send({
      statusCode: 200,
      message: 'ok',
      data: {
        total: result.length,
        results: result
      }
    });

  },


};
