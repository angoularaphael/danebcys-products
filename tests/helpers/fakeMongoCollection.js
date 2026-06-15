/**
 * Fausse collection MongoDB en mémoire pour tester index.service.
 * Implémente :
 *   findOne, find().project().sort().skip().limit().toArray(),
 *   countDocuments, insertOne, updateOne ($set/$inc), updateMany ($set),
 *   bulkWrite (updateOne avec upsert + $set/$setOnInsert),
 *   aggregate (sous-ensemble : $match, $group, $project, $sort, $limit).
 *
 * NB: c'est un mock simple : on n'essaie pas de couvrir toutes les sémantiques
 * Mongo, juste celles utilisées par notre code.
 */

function matches(doc, filter) {
  if (filter === null || filter === undefined) return true;
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      if (!val.some((f) => matches(doc, f))) return false;
      continue;
    }
    if (val instanceof RegExp) {
      if (typeof doc[key] !== 'string' || !val.test(doc[key])) return false;
      continue;
    }
    if (val && typeof val === 'object') {
      if ('$in' in val) {
        if (!val.$in.includes(doc[key])) return false;
        continue;
      }
      if ('$regex' in val) {
        if (typeof doc[key] !== 'string' || !val.$regex.test(doc[key])) return false;
        continue;
      }
      if ('$gte' in val || '$lte' in val || '$gt' in val || '$lt' in val) {
        const v = doc[key];
        if ('$gte' in val && !(v >= val.$gte)) return false;
        if ('$lte' in val && !(v <= val.$lte)) return false;
        if ('$gt' in val && !(v > val.$gt)) return false;
        if ('$lt' in val && !(v < val.$lt)) return false;
        continue;
      }
    }
    if (doc[key] !== val) return false;
  }
  return true;
}

function project(doc, projection) {
  if (!projection) return { ...doc };
  const keys = Object.keys(projection);
  const exclusionMode = keys.every((k) => projection[k] === 0);
  if (exclusionMode) {
    const out = { ...doc };
    for (const k of keys) delete out[k];
    return out;
  }
  const out = {};
  for (const k of keys) if (projection[k] === 1) out[k] = doc[k];
  return out;
}

function sortDocs(docs, spec) {
  const entries = Object.entries(spec);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = a[field], bv = b[field];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return cmp * (dir === 1 ? 1 : -1);
    }
    return 0;
  });
}

function createFakeCollection() {
  const docs = [];
  let nextId = 1;

  function makeId() {
    const id = String(nextId++).padStart(24, '0');
    return { toString: () => id, _isFakeId: true };
  }

  function buildCursor(filtered) {
    let working = filtered;
    let _project = null;
    let _skip = 0;
    let _limit = Infinity;
    const cursor = {
      project(p) { _project = p; return cursor; },
      sort(spec) { working = sortDocs(working, spec); return cursor; },
      skip(n) { _skip = n; return cursor; },
      limit(n) { _limit = n; return cursor; },
      toArray() {
        return Promise.resolve(
          working.slice(_skip, _skip + _limit).map((d) => project(d, _project))
        );
      }
    };
    return cursor;
  }

  return {
    insertOne(doc) {
      const _id = makeId();
      const inserted = { _id, ...doc };
      docs.push(inserted);
      return Promise.resolve({ insertedId: _id });
    },

    findOne(filter, options = {}) {
      let candidates = docs.filter((d) => matches(d, filter));
      if (options.sort) candidates = sortDocs(candidates, options.sort);
      return Promise.resolve(candidates[0] || null);
    },

    find(filter) {
      return buildCursor(docs.filter((d) => matches(d, filter)));
    },

    countDocuments(filter) {
      return Promise.resolve(docs.filter((d) => matches(d, filter)).length);
    },

    updateOne(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          doc[k] = (doc[k] || 0) + v;
        }
      }
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    },

    updateMany(filter, update) {
      const matched = docs.filter((d) => matches(d, filter));
      for (const doc of matched) {
        if (update.$set) Object.assign(doc, update.$set);
      }
      return Promise.resolve({ matchedCount: matched.length, modifiedCount: matched.length });
    },

    deleteMany(filter) {
      const before = docs.length;
      const remaining = docs.filter((d) => !matches(d, filter));
      docs.length = 0;
      docs.push(...remaining);
      return Promise.resolve({ deletedCount: before - docs.length });
    },

    bulkWrite(ops) {
      let inserted = 0, modified = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const { filter, update, upsert } = op.updateOne;
          const existing = docs.find((d) => matches(d, filter));
          if (existing) {
            if (update.$set) Object.assign(existing, update.$set);
            modified++;
          } else if (upsert) {
            const _id = makeId();
            const newDoc = { _id, ...(update.$setOnInsert || {}), ...(update.$set || {}) };
            docs.push(newDoc);
            inserted++;
          }
        }
      }
      return Promise.resolve({
        upsertedCount: inserted,
        modifiedCount: modified,
        insertedCount: 0,
        deletedCount: 0
      });
    },

    aggregate(pipeline) {
      let working = [...docs];
      for (const stage of pipeline) {
        if (stage.$match) {
          working = working.filter((d) => matches(d, stage.$match));
        } else if (stage.$group) {
          const groups = new Map();
          for (const doc of working) {
            const id = stage.$group._id;
            const key = typeof id === 'string'
              ? doc[id.replace(/^\$/, '')]
              : JSON.stringify(Object.fromEntries(
                  Object.entries(id).map(([k, v]) => [k, doc[String(v).replace(/^\$/, '')]])
                ));
            if (!groups.has(key)) {
              const groupId = typeof id === 'string'
                ? doc[id.replace(/^\$/, '')]
                : Object.fromEntries(
                    Object.entries(id).map(([k, v]) => [k, doc[String(v).replace(/^\$/, '')]])
                  );
              groups.set(key, { _id: groupId, count: 0 });
            }
            const g = groups.get(key);
            for (const [k, op] of Object.entries(stage.$group)) {
              if (k === '_id') continue;
              if (op.$sum) g[k] = (g[k] || 0) + (typeof op.$sum === 'number' ? op.$sum : 0);
            }
          }
          working = [...groups.values()];
        } else if (stage.$project) {
          working = working.map((d) => {
            const out = {};
            for (const [k, v] of Object.entries(stage.$project)) {
              if (v === 0) continue;
              if (v === 1) out[k] = d[k];
              else if (typeof v === 'string' && v.startsWith('$')) {
                const path = v.slice(1).split('.');
                let cur = d;
                for (const p of path) cur = cur?.[p];
                out[k] = cur;
              }
            }
            return out;
          });
        } else if (stage.$sort) {
          working = sortDocs(working, stage.$sort);
        } else if (stage.$limit) {
          working = working.slice(0, stage.$limit);
        }
      }
      return { toArray: () => Promise.resolve(working) };
    },

    _all: () => docs,
    _reset: () => { docs.length = 0; nextId = 1; }
  };
}

module.exports = { createFakeCollection };
