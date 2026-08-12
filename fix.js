const fs = require('fs');
const content = fs.readFileSync('app/transactions/page.tsx', 'utf-8');

const oldHasInstallments = `            } else if ((relatedInstallments.length > 0 && data.installments !== editingTransaction.installments) || (relatedInstallments.length === 0 && hasInstallments)) {
              if (relatedInstallments.length > 0) {
                for (const t of relatedInstallments) {
                  await localDB.delete('transactions', t.id);
                }
              } else {
                await localDB.delete('transactions', editingTransaction.id);
              }
              const installmentValue = data.value / data.installments;
              const rawDate = (data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate
                ? data.firstInstallmentDate
                : data.date;
              const baseDate = new Date(String(rawDate).slice(0, 10) + 'T12:00:00Z');
              const groupId = editingTransaction.groupId || Math.random().toString(36).substr(2, 9);
              
              const arr = [];
              for (let i = 0; i < data.installments; i++) {
                 const installmentDate = addMonths(baseDate, i);
                 const installmentNum = (i + 1).toString().padStart(2, '0');
                 const totalInstallments = data.installments.toString().padStart(2, '0');
                 arr.push({
                     ...basePayload,
                     value: installmentValue,
                     date: toDbDate(format(installmentDate, 'yyyy-MM-dd'))!,
                     description: \`\${finalEntityName} (\${installmentNum}/\${totalInstallments})\`,
                     status: isCreditCard ? 'pago' : (i === 0 ? data.status : 'a_pagar'),
                     groupId,
                     currentInstallment: i + 1,
                     createdAt: editingTransaction.createdAt
                 });
              }
              await localDB.saveMany('transactions', arr);
            } else if (editingTransaction.groupId && data.recurrent) {`;

const newHasInstallments = `            } else if (editingTransaction.groupId && data.recurrent) {`;

const oldRecurrent = `              months.forEach((mIndex: number) => {
                if (!existingMap.has(mIndex)) {
                  const lastDay = new Date(year, mIndex + 1, 0).getDate();
                  const targetDay = Math.min(originalDay, lastDay);
                  const targetDate = new Date(year, mIndex, targetDay, 12, 0, 0);

                  toUpsert.push({
                    ...basePayload,
                    groupId: editingTransaction.groupId,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                }
              });

              if (toDeleteIds.length > 0) {
                await localDB.deleteMany('transactions', toDeleteIds);
              }
              if (toUpsert.length > 0) {
                await localDB.saveMany('transactions', toUpsert);
              }
            } else {`;

const newRecurrent = `              months.forEach((mIndex: number) => {
                if (!existingMap.has(mIndex)) {
                  const lastDay = new Date(year, mIndex + 1, 0).getDate();
                  const targetDay = Math.min(originalDay, lastDay);
                  const targetDate = new Date(year, mIndex, targetDay, 12, 0, 0);

                  toUpsert.push({
                    ...basePayload,
                    groupId: editingTransaction.groupId,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                }
              });

              if (toDeleteIds.length > 0) {
                await localDB.deleteMany('transactions', toDeleteIds);
              }
              if (toUpsert.length > 0) {
                await localDB.saveMany('transactions', toUpsert);
              }
            } else if ((relatedInstallments.length > 0 && data.installments !== editingTransaction.installments) || (relatedInstallments.length === 0 && hasInstallments)) {
              if (relatedInstallments.length > 0) {
                for (const t of relatedInstallments) {
                  await localDB.delete('transactions', t.id);
                }
              } else {
                await localDB.delete('transactions', editingTransaction.id);
              }
              const installmentValue = data.value / data.installments;
              const rawDate = (data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate
                ? data.firstInstallmentDate
                : data.date;
              const baseDate = new Date(String(rawDate).slice(0, 10) + 'T12:00:00Z');
              const groupId = editingTransaction.groupId || Math.random().toString(36).substr(2, 9);
              
              const arr = [];
              for (let i = 0; i < data.installments; i++) {
                 const installmentDate = addMonths(baseDate, i);
                 const installmentNum = (i + 1).toString().padStart(2, '0');
                 const totalInstallments = data.installments.toString().padStart(2, '0');
                 arr.push({
                     ...basePayload,
                     value: installmentValue,
                     date: toDbDate(format(installmentDate, 'yyyy-MM-dd'))!,
                     description: \`\${finalEntityName} (\${installmentNum}/\${totalInstallments})\`,
                     status: isCreditCard ? 'pago' : (i === 0 ? data.status : 'a_pagar'),
                     groupId,
                     currentInstallment: i + 1,
                     createdAt: editingTransaction.createdAt
                 });
              }
              await localDB.saveMany('transactions', arr);
            } else {`;

if (content.includes(oldHasInstallments) && content.includes(oldRecurrent)) {
  let updated = content.replace(oldHasInstallments, newHasInstallments);
  updated = updated.replace(oldRecurrent, newRecurrent);
  
  // also modify the recurrent block to use the isInstallment logic
  const recurrentOldLogic = `              const year = data.recurrentYear || parseLocalDate(data.date).getFullYear();
              const months = data.recurrentMonths || [];
              const baseRecurrentDate = ((data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate) 
                ? data.firstInstallmentDate 
                : data.date;
              const originalDay = parseLocalDate(baseRecurrentDate).getDate();

              const existingTxs = await localDB.get('transactions', user.uid, context, { groupId: editingTransaction.groupId });
              const existingMap = new Map();
              existingTxs.forEach((t: any) => {
                if (t.date) existingMap.set(parseLocalDate(t.date).getMonth(), t);
              });

              const toDeleteIds: string[] = [];
              const toUpsert: any[] = [];

              existingTxs.forEach((t: any) => {
                const mIndex = parseLocalDate(t.date).getMonth();
                if (!months.includes(mIndex)) {
                  toDeleteIds.push(t.id);
                } else {
                  const lastDay = new Date(year, mIndex + 1, 0).getDate();
                  const targetDay = Math.min(originalDay, lastDay);
                  const targetDate = new Date(year, mIndex, targetDay, 12, 0, 0);

                  toUpsert.push({
                    ...t,
                    ...basePayload,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                }
              });

              months.forEach((mIndex: number) => {
                if (!existingMap.has(mIndex)) {
                  const lastDay = new Date(year, mIndex + 1, 0).getDate();
                  const targetDay = Math.min(originalDay, lastDay);
                  const targetDate = new Date(year, mIndex, targetDay, 12, 0, 0);

                  toUpsert.push({
                    ...basePayload,
                    groupId: editingTransaction.groupId,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                }
              });`;

  const recurrentNewLogic = `              const year = data.recurrentYear || parseLocalDate(data.date).getFullYear();
              const sortedMonths = [...(data.recurrentMonths || [])].sort((a, b) => a - b);
              const baseRecurrentDate = ((data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate) 
                ? data.firstInstallmentDate 
                : data.date;
              const originalDay = parseLocalDate(baseRecurrentDate).getDate();

              const existingTxs = await localDB.get('transactions', user.uid, context, { groupId: editingTransaction.groupId });
              const existingMap = new Map();
              existingTxs.forEach((t: any) => {
                if (t.date) existingMap.set(parseLocalDate(t.date).getMonth(), t);
              });

              const toDeleteIds: string[] = [];
              const toUpsert: any[] = [];
              
              const isInstallment = hasInstallments || (editingTransaction.installments && editingTransaction.installments > 1);
              const totalInstallmentsStr = sortedMonths.length.toString().padStart(2, '0');

              existingTxs.forEach((t: any) => {
                const mIndex = parseLocalDate(t.date).getMonth();
                if (!sortedMonths.includes(mIndex)) {
                  toDeleteIds.push(t.id);
                }
              });

              sortedMonths.forEach((mIndex: number, i: number) => {
                const lastDay = new Date(year, mIndex + 1, 0).getDate();
                const targetDay = Math.min(originalDay, lastDay);
                const targetDate = new Date(year, mIndex, targetDay, 12, 0, 0);
                
                const instNumStr = (i + 1).toString().padStart(2, '0');
                const desc = isInstallment ? \`\${finalEntityName} (\${instNumStr}/\${totalInstallmentsStr})\` : finalEntityName;
                const instVal = isInstallment ? (data.value / sortedMonths.length) : data.value;

                const existingTx = existingMap.get(mIndex);
                if (existingTx) {
                  toUpsert.push({
                    ...existingTx,
                    ...basePayload,
                    description: desc,
                    value: instVal,
                    installments: isInstallment ? sortedMonths.length : 1,
                    currentInstallment: isInstallment ? (i + 1) : null,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                } else {
                  toUpsert.push({
                    ...basePayload,
                    groupId: editingTransaction.groupId,
                    description: desc,
                    value: instVal,
                    installments: isInstallment ? sortedMonths.length : 1,
                    currentInstallment: isInstallment ? (i + 1) : null,
                    date: toDbDate(format(targetDate, 'yyyy-MM-dd'))!,
                    renewalDate: data.renewalDate 
                      ? toDbDate(format(new Date(year, mIndex, Math.min(parseLocalDate(data.renewalDate).getDate(), lastDay), 12, 0, 0), 'yyyy-MM-dd')) 
                      : null,
                  });
                }
              });`;

  updated = updated.replace(recurrentOldLogic, recurrentNewLogic);

  fs.writeFileSync('app/transactions/page.tsx', updated);
  console.log("Success");
} else {
  console.log("Could not find blocks");
}
