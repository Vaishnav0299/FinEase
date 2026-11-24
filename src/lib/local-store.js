import { localDay } from './finance.js'
import { emptyWorkspace, sampleWorkspace } from './workspace.js'

let connection

function database() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('finease', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('plans')
        request.result.createObjectStore('files')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => { connection = undefined; reject(request.error) }
    })
  }
  return connection
}

function initialPlan(key) {
  return key === 'example' ? sampleWorkspace(localDay()) : emptyWorkspace()
}

export async function readPlan(key) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('plans').objectStore('plans').get(key)
    request.onsuccess = () => resolve(request.result ?? initialPlan(key))
    request.onerror = () => reject(request.error)
  })
}

// Read-modify-write and the corresponding attachment change commit in one transaction.
export async function changePlan(key, change) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['plans', 'files'], 'readwrite')
    const plans = tx.objectStore('plans')
    const request = plans.get(key)
    let result
    let failure
    request.onsuccess = () => {
      try {
        const plan = request.result ?? initialPlan(key)
        result = change(plan, tx.objectStore('files'))
        plans.put(plan, key)
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Your browser could not save the change.'))
  })
}

export async function localFile(key, id) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('files').objectStore('files').get(key + '/' + id)
    request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error('This file is missing from browser storage.'))
    request.onerror = () => reject(request.error)
  })
}
