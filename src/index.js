/* 
The MIT License (MIT)

Copyright (c) 2016 AnyWhichWay, Simon Y. Blackwell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function() {
	let _uuid;
	if(typeof(window)==="undefined") {
		let r = require;
		_uuid = r("node-uuid");
	}
	
	/*async function asyncForEach(f) {
		let iterable = this;
		for(var i=0;i<iterable.length;i++) {
			await f(iterable[i]);
		}
		return;
	}
	async function asyncEvery(f) {
		let iterable = this;
		for(var i=0;i<iterable.length;i++) {
			let result = await f(iterable[i]);
			if(!result) { return; }
		}
		return;
	}
	async function asyncSome(f) {
		let iterable = this;
		for(var i=0;i<iterable.length;i++) {
			let result = await f(iterable[i]);
			if(result) { return; }
		}
		return;
	}*/
	
	function wait(object,property,ms=1000,count=1,test) {
		let promises, promise;
		if(!test) {
			test = function(value) {
				if(value!==test.value) {
					return true;
				}
			}
			test.value = object[property];
		}
		if(wait.promised[property]) {
			promises = wait.promised[property].get(object);
			if(promises) {
				promise = promises.get(test);
				if(promise) {
					return promise;
				}
			} else {
				promises = new Map();
				wait.promised[property].set(object,promises);
			}
		} else {
			wait.promised[property] = new Map();
			promises = new Map();
			wait.promised[property].set(object,promises);
		}
		promise = new Promise((resolve,reject) => {
			let waiter = (() => {
				let value = object[property];
				if(test(value)) {
					wait.promised[property].delete(object);
					if(wait.promised[property].size===0) {
						delete wait.promised[property];
					}
					resolve(value);
				} else if(count>0) {
					count--;
					setTimeout(waiter,ms);
				} else {
					resolve();
				}
			})
			waiter();
		});
		promises.set(test,promise);
		return promise;
	}
	wait.promised = {};
	
	class Activity {
		constructor(abort=(()=>{})) {
			let me = this;
			this.steps = [];
			this.results = [];
			this.abort = (result) => { me.aborted=true; abort(result); };
		}
		exec(i=0,value) {
			if(this.aborted) { return; }
			let me = this,
				step = me.steps[i],
				steps = (Array.isArray(step) ? step : [step]);
			steps.every((step) => {
				if(!step) {
					console.log("WARNING: undefined Activity step");
					return;
				}
				if(step instanceof Promise || (step.constructor.name==="Promise" && typeof(step.then)==="function")) {
					step.then((result) => {
						return me.complete(i,result);
					});
					return false;
				} else {
					let result = step(value,me.abort);
					if(result instanceof Promise || (result && result.constructor.name==="Promise" && typeof(result.then)==="function")) {
						result.then((result) => {
							return me.complete(i,result);
						});
						return false;
					}
					me.complete(i,result);
					return true;
				}
			});	
		}
		reset() {
			this.results = [];
		}
		step(f) {
			if(f) {
				this.steps.push(f);
			}
			//if(this.steps.length===this.results.length+1) {
			//	this.exec(this.steps.length-1,this.results[this.results.length-1]);
			//}
			return this;
		}
		complete(i,result) {
			let me = this;
			//if(i===me.results.length) {
				if(i<me.steps.length-1) {
					me.results[i] = result;
					me.exec(i+1,result)
				}
			//}
		}
	}

	Array.indexKeys = ["length","$max","$min","$avg","*"];
	Array.reindexCalls = ["push","pop","splice","reverse","fill","shift","unshift"];
	Array.fromJSON = function(json) {
		let array = [];
		Object.keys(json).forEach((key) => {
			array[key] = json[key];
		});
		return array;
	}
	Object.defineProperty(Array.prototype,"$max",{enumerable:false,configurable:true,
		get:function() { let result; this.forEach((value) => { result = (result!=null ? (value > result ? value : result) : value); }); return result;},
		set:function() { }
	});
	Object.defineProperty(Array.prototype,"$min",{enumerable:false,configurable:true,
		get:function() { let result; this.forEach((value) => { result = (result!=null ? (value < result ? value : result) : value); }); return result;},
		set:function() { }
	});
	Object.defineProperty(Array.prototype,"$avg",{enumerable:false,configurable:true,
		get:function() { 
			let result = 0, count = 0; 
			this.forEach((value) => {
				let v = value.valueOf();
				if(typeof(v)==="number") {
					count++;
					result += v;
				}
			});
			return result / count;
			},
		set:function() { }
	});
	
	Date.indexKeys = ["*"];
	Date.reindexCalls = [];
	Date.fromJSON = function(json) {
		let dt = new Date(json.time);
		Object.keys(json).forEach((key) => {
			if(key!=="time") {
				dt[key] = json[key];
			}
		});
		return dt;
	}
	Object.getOwnPropertyNames(Date.prototype).forEach((key) => {
		if(key.indexOf("get")===0) {
			let name = (key.indexOf("UTC")>=0 ? key.slice(3) : key.charAt(3).toLowerCase() + key.slice(4)),
				setkey = "set" + key.slice(3),
				get = function() { return this[key](); },
				set = function(value) { if(Date.prototype[setKey]) { Date.prototype[setKey].call(this,value); } return true; }
			Object.defineProperty(Date.prototype,name,{enumerable:false,configurable:true,get:get,set:set});
			Date.indexKeys.push(name);
			if(Date.prototype[setkey]) {
				Date.reindexCalls.push(setkey);
			}
		}
	});
	
	/*
	 * https://github.com/Benvie
	 * improvements 2015 by AnyWhichWay
	 */
	function intersection(h){var a=arguments.length;if(0===a)return[];if(1===a)return intersection(h,h);var e=0,k=0,l=0,m=[],d=[],n=new Map,b;do{var p=arguments[e],q=p.length,f=1<<e;b=0;if(!q)return[];k|=f;do{var g=p[b],c=n.get(g);"undefined"===typeof c?(l++,c=d.length,n.set(g,c),m[c]=g,d[c]=f):d[c]|=f}while(++b<q)}while(++e<a);a=[];b=0;do d[b]===k&&(a[a.length]=m[b]);while(++b<l);return a}
	
	//soundex from https://gist.github.com/shawndumas/1262659
	function soundex(a){a=(a+"").toLowerCase().split("");var c=a.shift(),b="",d={a:"",e:"",i:"",o:"",u:"",b:1,f:1,p:1,v:1,c:2,g:2,j:2,k:2,q:2,s:2,x:2,z:2,d:3,t:3,l:4,m:5,n:5,r:6},b=c+a.map(function(a){return d[a]}).filter(function(a,b,e){return 0===b?a!==d[c]:a!==e[b-1]}).join("");return(b+"000").slice(0,4).toUpperCase()};
	
	// http://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
	function getRandomInt(min, max) {
	    return Math.floor(Math.random() * (max - min + 1)) + min;
	}
	
	//Shanti R Rao and Potluri M Rao, "Sample Size Calculator", 
	//Raosoft Inc., 2009, http://www.raosoft.com/samplesize.html
	//probCriticalNormal function is adapted from an algorithm published
	//in Numerical Recipes in Fortran.
	function probCriticalNormal(a){var d,e,b,c;b=[0,-.322232431088,-1,-.342242088547,-.0204231210245,-4.53642210148E-5];var f=[0,.099348462606,.588581570495,.531103462366,.10353775285,.0038560700634];a=.5-a/2;if(1E-8>=a)b=6;else if(.5==a)b=0;else{a=Math.sqrt(Math.log(1/(a*a)));d=b[5];e=f[5];for(c=4;1<=c;c--)d=d*a+b[c],e=e*a+f[c];b=a+d/e}return b};
	function samplesize(confidence, margin, population)
	{
		var response = 50, pcn = probCriticalNormal(confidence / 100.0),
	     d1 = pcn * pcn * response * (100.0 - response),
	     d2 = (population - 1.0) * (margin * margin) + d1;
	    if (d2 > 0.0)
	     return Math.ceil(population * d1 / d2);
	    return 0.0;
	}
	
	function CXProduct(collections,filter) {
		this.collections = (collections ? collections : []);
		this.filter = filter;
		Object.defineProperty(this,"length",{set:function() {},get:function() { if(this.collections.length===0){ return 0; } if(this.start!==undefined && this.end!==undefined) { return this.end - this.start; }; var size = 1; this.collections.forEach(function(collection) { size *= collection.length; }); return size; }});
		Object.defineProperty(this,"size",{set:function() {},get:function() { return this.length; }});
	}
	// there is probably an alogorithm that never returns null if index is in range and takes into account the restrict right
	CXProduct.prototype.get = function(index){
		var me = this, c = [];
		function get(n,collections,dm,c) {
			for (var i=collections.length;i--;) c[i]=collections[i][(n/dm[i][0]<<0)%dm[i][1]];
		}
		for (var dm=[],f=1,l,i=me.collections.length;i--;f*=l){ dm[i]=[f,l=me.collections[i].length];  }
		get(index,me.collections,dm,c);
		if(me.filter(c)) {
			return c.slice(0);
		}
	}
	class Cursor {
		constructor(classes,cxProductOrRows,projection,classVars={}) {
			let me = this;
			me.classes = classes;
			if(Array.isArray(cxProductOrRows)) {
				me.rows = cxProductOrRows;
			} else {
				me.cxproduct = cxProductOrRows;
			}
			me.projection = projection;
			me.classVarMap = {};
			me.classVars = classVars;
			Object.keys(classVars).forEach((classVar,i) => {
				me.classVarMap[classVar] = i;
			});
		}
		async first(count) {
			let cursor = this;
			return new Promise((resolve,reject) => {
				let results = [];
				cursor.forEach((row) => {
					if(results.length<count) {
						results.push(row);
					}
					if(results.length===count) {
						resolve(results);
					}
				}).then(() => {
					if(results.length<count) {
						resolve(results);
					}
				});
			});
		}
		async forEach(f) {
			let cursor = this;
			return new Promise((resolve,reject) => {
				let promises = [],
					results = [],
					i = 0;
				function rows() {
					promises.push(cursor.get(i).then((row) => {
						if(row) {
							let result = f(row,i,cursor);
							if(!(result instanceof Promise)) {
								result = Promise.resolve(result);
							}
							results.push(result);
						}
					}));
					i++;
					if(i < cursor.maxCount) {
						rows();
					}
				}
				rows();
				Promise.all(promises).then((rows) => {
					resolve(results);
				});
				//resolve(promises);
			});
		}
		async every(f) {
			let cursor = this,
				result = true;
			return new Promise((resolve,reject) => {
				cursor.forEach((row) => {
					if(result && !f(row)) {
						result = false;
						resolve(false);
					};
				}).then(() => {
					if(result) {
						resolve(result);
					}
				});
			});
		}
		async random(count) {
			let cursor = this,
				maxcount = cursor.maxCount,
				done = {},
				results = [],
				resolver,
				rejector,
				promise = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; });
			function select() {
				let i = getRandomInt(0,cursor.maxCount-1);
				if(!done[i]) {
					done[i] = true;
					cursor.get(i).then((row) => {
						if(row) {
							if(results.length<count && results.length<maxcount) {
								results.push(row);
							}
							if(results.length===count || results.length===maxcount) {
								resolver(results);
								return;
							}
						} else {
							maxcount--;
						}
						select();
					});
				} else {
					select();
				}
			}
			select();
			return promise;
		}
		async sample(confidence, margin) {
			let cursor = this,
				done = {},
				results = [],
				resolver,
				rejector,
				promise = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; });
			cursor.count().then((population) => {
				let count = samplesize(confidence, margin,population);
				function select() {
					let i = getRandomInt(0,cursor.maxCount-1);
					if(!done[i]) {
						done[i] = true;
						cursor.get(i).then((row) => {
							if(row) {
								if(results.length<count) {
									results.push(row);
								}
								if(results.length===count) {
									resolver(results);
									return;
								}
							}
							select();
						});
					} else {
						select();
					}
				}
				select();
			});
			return promise;
		}
		async some(f) {
			let cursor = this,
				result = false;
			return new Promise((resolve,reject) => {
				cursor.forEach((row) => {
					if(f(row)) {
						result = true;
						resolve(true);
					}
				}).then(() => {
					if(!result) {
						resolve(false);
					}
				});
			});
		}
		async count() {
			let cursor = this,
				i = 0;
			return new Promise((resolve,reject) => {
				cursor.forEach((row) => {
					i++;
				}).then(() => {
					resolve(i);
				});
			});
		}
		async get(rowNumber) {
			let me = this;
			if(me.rows) {
				if(rowNumber<me.maxCount) {
					return me.rows[rowNumber];
				}
				return undefined; // should we throw an error?
			}
			return new Promise((resolve,reject) => {
				let promises = [],
					vars = Object.keys(me.classVars);
				if(rowNumber>=0 && rowNumber<me.cxproduct.length) {
					let row = me.cxproduct.get(rowNumber);
					if(row) {
						row.forEach((id,col) => {
							let classVar = vars[col],
							cls = me.classVars[classVar];
							promises.push(cls.index.get(row[col]));
						});
						Promise.all(promises).then((instances) => {
							let result;
							if(me.projection) {
								result = {};
								if(!Object.keys(me.projection).every((property) => {
									let colspec = me.projection[property];
									if(colspec && typeof(colspec)==="object") {
										let classVar = Object.keys(colspec)[0],
											key = colspec[classVar],
											col = me.classVarMap[classVar];
										if(instances[col]) {
											result[property] = instances[col][key];
											return true;
										}
									}
								})) {
									resolve();
								}
							} else {
								result = [];
								if(!instances.every((instance) => {
									if(instance) {
										result.push(instance);
										return true;
									}
								})) {
									resolve();
								}
							}
							resolve(result);
						});
					} else {
						resolve();
					}
				} else {
					resolve();
				}
			});	
		}
		get maxCount() {
			return (this.rows ? this.rows.length : this.cxproduct.length);
		}
	}
	function stream(object,db) {
		let fired = {},
			cls = object.constructor;
		Index.keys(object).forEach((key) => {
			if(db.patterns[cls.name] && db.patterns[cls.name][key]) {
				Object.keys(db.patterns[cls.name][key]).forEach((patternId) => {
					if(fired[patternId]) { return; }
					Object.keys(db.patterns[cls.name][key][patternId]).forEach((classVar) => {
						let pattern = db.patterns[cls.name][key][patternId][classVar],
							projection,
							when = {};
						if(!pattern.action) { return; }
						if(pattern.projection) {
							projection = {};
							Object.keys(pattern.projection).forEach((key) => {
								if(key!==db.keyProperty) {
									projection[key] = pattern.projection[key];
								}
							});
						}
						Object.keys(pattern.when).forEach((key) => {
							if(key!==db.keyProperty) {
								when[key] = {};
								Object.keys(pattern.when[key]).forEach((wkey) => {
									when[key][wkey] = pattern.when[key][wkey];
								});
								if(pattern.classVars[key] && object instanceof pattern.classVars[key]) {
									when[key][db.keyProperty] = object[db.keyProperty];
								}
							}
						});
						db.select(projection).from(pattern.classVars).where(when).exec().then((cursor) => { 
							if(!fired[patternId] && cursor.maxCount>0) { 
								fired[patternId]=true;
								pattern.action(cursor); 
							} 
						});
					});
				});
			}
		});
	}
	 
	class Index {
		constructor(cls,keyProperty="@key",db,StorageType=(db ? db.storageType : MemStore),clear=(db ? db.clear : false)) {
			let me = this;
			cls.index = me;
			me.keys = {};
			me.store = new StorageType(cls.name,keyProperty,db,clear);
			me.name = cls.name;
			me.pending = {};
		}
		static coerce(value,type) {
			let conversions = {
					string: {
						number: parseFloat,
						boolean: (value) => { return (["true","yes","on"].indexOf(value)>=0 ? true : (["false","no","off"].indexOf(value)>=0 ? false : value)); }
					},
					number: {
						string: (value) => { return value+""; },
						boolean: (value) => { return !!value; }
					},
					boolean: {
						number: (value) => { return (value ? 1 : 0); },
						string: (value) => { return value+""; }
					}
				},
				vtype = typeof(value);
			if(type===vtype) {
				return value;
			}
			if(conversions[vtype] && conversions[vtype][type]) {
				return conversions[vtype][type](value);
			}
			return value;
		}
		static keys(object) {
			let indexkeys;
			if(object.indexKeys) {
				indexkeys = object.indexKeys;
			} else if(object.constructor.indexKeys) {
				indexkeys = object.constructor.indexKeys
			}
			if(indexkeys) {
				let i = indexkeys.indexOf("*");
				if(i>=0) {
					indexkeys = indexkeys.concat(Object.keys(object));
				}
			} else {
				indexkeys = Object.keys(object);
			}
			return indexkeys.filter((key) => {
				return key!=="*";
			});
		}
		isInstanceKey(key) {
			if(key.indexOf(this.name+"@")===0) {
				return true;
			}
		}
		async clear() {
			let index = this,
				promises = [];
			Object.keys(index).forEach((key) => {
				promises.push(index.delete(key));
			});
			return new Promise((resolve,reject) => {
				Promise.all(promises).then(() => { resolve(); });
			});
		}
		async delete(id) {
			let index = this,
				store = index.store,
				keyProperty = store.keyProperty,
				pending = index.pending[id];
			function doit() {
				 return new Promise((resolve,reject) => {
					index.get(id,(object) => { 
						let promises = [];
						promises.push(store.delete(id,true).catch((e) => { console.log(e); }));
						if(object) {
							Index.keys(object).forEach((key) => {
								promises.push(new Promise((resolve,reject) => {
									index.get(key,(node) => {
										if(!node) { 
											resolve();
											return;
										}
										let value = object[key],
											type = typeof(value);
										if(type==="object") {
											if(!value) {
												if(node.null) {
													delete node.null[id];
												}
											} else if(value[keyProperty]) {
												let idvalue = value[keyProperty];
												if(node[idvalue][type] && node[idvalue][type][id]) {
													delete node[idvalue][type][id];
												}
											}
											index.save(key,()=>{ resolve(true); }).catch((e) => { console.log(e); });;
										} else if(type!=="undefined") {
											if(!node[value] || !node[value][type] || !node[value][type][id]) {
												resolve();
												return;
											}
											delete node[value][type][id];
											index.save(key).then(()=>{ resolve(true); }).catch((e) => { console.log(e); });
										}
									});
								}).catch((e) => { console.log(e); }));
							});
						}
						Promise.all(promises).then(() => {
							if(object) {
								delete object[keyProperty];
							}
							delete index.keys[id];
							resolve();
						}).catch((e) => {
							console.log(e);
						});
					}).catch((e) => {
						console.log(e);
					});
				});
			}
			if(pending) {
				return new Promise((resolve,reject) => {
					pending.then((result) => {
						if(typeof(result)!=="undefined") {
							let pending = doit();
							index.pending[id] = pending;
							pending.then(() => {
								//console.log("deleted")
								resolve(true);
							});
						}
					});
				});
			} else {
				pending = index.pending[id] = doit();
				return new Promise((resolve,reject) => {
					pending.then((result) => {
						delete index.pending[id];
						resolve(true);
					});
				});
			}
		}
		flush(key) {
			let index = this,
				indexkey = (this.isInstanceKey(key) ? key : index.name + "." + key),
				desc = Object.getOwnPropertyDescriptor(this.keys,indexkey);
			if(desc) {
				this.keys[key] = false;
			}
		}
		async get(key,f,init) {
			let index = this,
				indexkey = (this.isInstanceKey(key) ? key : index.name + "." + key),
				value = index.keys[indexkey],
				promise = index.pending[key];
			if(promise) {
				return promise;
			}
			if(!value) {
				if(init) {
					value = index.keys[indexkey] = {};
				}
				let resolver,
					rejector;
				promise = index.pending[key] = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; });
				let activity = new Activity(resolver)
					.step(() => index.store.get(indexkey))
					.step((storedvalue,abort) => {
						delete index.pending[key];
						let type = typeof(storedvalue);
						if(type==="undefined") {
							if(init) {
								value = index.keys[indexkey] = {};
							}
						} else {
							value = index.keys[indexkey] = storedvalue;
							if(type==="object" && index.isInstanceKey(key)) {
								return index.index(value,false,index.store.db.activate);
							}
						}
						return value;
					})
					.step(f)
					.step(resolver)
					.exec();
				return promise;
			}
			if(f) {
				f(value);
			}
			return Promise.resolve(value);
		}
		async index(object,reIndex,activate) {
			let index = this,
				store = index.store,
				cls = object.constructor,
				id = object[store.keyProperty],
				resolver,
				rejector,
				promise = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; });
			index.keys[id] = object;
			if(object.constructor.reindexCalls) {
				object.constructor.reindexCalls.forEach((fname) => {
					let f = object[fname];
					if(!f.reindexer) {
						Object.defineProperty(object,fname,{configurable:true,writable:true,value:function() {
							let me = this;
							f.call(me,...arguments);
							index.index(me,true,db.activate).then(() => {
								stream(me,db);
							});
						}});
						object[fname].reindexer = true;
					}
				});
			}
			let indexed = (reIndex ? store.set(id,object,true) : Promise.resolve());
			indexed.then(() => {
				let activity = new Activity(resolver);
				Index.keys(object).forEach((key) => {
					let value = object[key],
						desc = Object.getOwnPropertyDescriptor(object,key);
					function get() {
						return get.value;
					}
					if(!reIndex) {
						get.value = value;
					}
					function set(value,first) {
						let instance = this,
							cls = instance.constructor,
							index = cls.index,
							store = index.store,
							indexkey = cls.name + "." + key,
							keyProperty = store.keyProperty,
							db = store.db,
							id = instance[keyProperty],
							oldvalue = get.value,
							oldtype = typeof(oldvalue),
							type = typeof(value);
						if(oldtype==="undefined" || oldvalue!=value) {
							if(type==="undefined") {
								delete get.value;
							} else {
								get.value = value;
							}
							if(type==="function") {
								value = value.call(instance);
								type = typeof(value);
							}
							return new Promise((resolve,reject) => {
									index.get(key,(node) => {
										node = index.keys[indexkey]; // re-assign since 1) we know it is loaded and initialized, 2) it may have been overwritten by another async
										if(!instance[keyProperty]) { // object may have been deleted by another async call!
											if(node[oldvalue] && node[oldvalue][oldtype]) {
												delete node[oldvalue][oldtype][id];
											}
											resolve(true);
											return;
										} 
										if(value && type==="object") {
											let ocls = value.constructor;
											if(!ocls.index) {
												db.index(ocls);
											}
											ocls.index.put(value).then(() => {
												let okey = value[keyProperty],
													otype = value.constructor.name;
												if(!node[okey]) {
													node[okey] = {};
												}
												if(!node[okey][otype]) {
													node[okey][otype] = {};
												}
												node[okey][otype][id] = true;
												let restorable = false;
												if(node[oldvalue] && node[oldvalue][oldtype]) {
													delete node[oldvalue][oldtype][id];
													restorable = true;
												}
												// chaing then. get rid of promises
												let promise = (first ? Promise.resolve() : store.set(id,instance,true));
												promise.then(() => { 
													index.save(key,() => { 
														resolve(true);
														if(!first) {
															stream(object,db);
														}
													}).catch((e) => {
														throw(e);
													});
												}).catch((e) => {
													delete node[okey][otype][id];
													if(restorable) {
														node[oldvalue][oldtype][id] = true;
													}
												});;
												
											});
										} else if(type!=="undefined") {
											if(!node[value]) {
												node[value] = {};
											}
											if(!node[value][type]) {
												node[value][type] = {};
											}
											node[value][type][id] = true;
											let restorable = false;
											if(node[oldvalue] && node[oldvalue][oldtype]) {
												delete node[oldvalue][oldtype][id];
												restorable = true;
											}
											let promise = (first ? Promise.resolve() : store.set(id,instance,true));
											promise.then(() => { 
												index.keys[key] = node;
												index.store.set(index.name + "." + key,node).then(() => {
													resolve(true);
													if(!first) {
														stream(object,db);
													}
												});
											}).catch((e) => {
												delete node[value][type][id];
												if(restorable) {
													node[oldvalue][oldtype][id] = true;
												}
											});
										}
									},true);
							});
						} else {
							return Promise.resolve(true);
						}
					}
					let writable = desc && !!desc.configurable && !!desc.writable;
					if(activate && desc && writable && !desc.get && !desc.set) {
						delete desc.writable;
						delete desc.value;
						desc.get = get;
						desc.set = set;
						Object.defineProperty(object,key,desc);
					}
					if(reIndex) {
						activity.step(() => set.call(object,value,true));
					}
				});
				activity.step(() => resolver(object)).exec();
			});
			return promise;
		}
		async instances(keyArray,cls) {
			let index = this,
				results = [];
			for(var i=0;i<keyArray.length;i++) {
				try {
					await index.get(keyArray[i],(instance) => {
						if(!cls || instance instanceof cls) {
							results.push(instance);
						} 
					});
				} catch(e) {
					console.log(e);
				}
			}
			return results;
		}
		async match(pattern,classVars={},classMatches={},restrictRight={},classVar="$self",parentKey,nestedClass) {
			let keys = Object.keys(pattern).filter((key) => { return key!="$class"; }),
				promises = [],
				literals = {},
				tests = {},
				nestedobjects = {},
				joinvars = {},
				joins = {},
				cols = {},
				results = classMatches,
				currentclass = (pattern.$class ? pattern.$class : (nestedClass ? nestedClass : (classVars[classVar] ? classVars[classVar] : Object)));
			if(typeof(currentclass)==="string") {
				try {
					currentclass = new Function("return " + currentclass)();
				} catch(e) {
					return Promise.resolve([]);
				}
			}
			let	index = currentclass.index,
				keyProperty = currentclass.name + "." + index.store.keyProperty;
			Object.keys(classVars).forEach((classVar,i) => {
				cols[classVar] = i;
				if(!results[classVar]) { results[classVar] = null; }
				if(!restrictRight[i]) { restrictRight[i] = {}; };
			});
			let nodes = [];
			for(var i=0;i<keys.length;i++) {
				let key = keys[i];
				if(!classVars[key]) {
					try {
						nodes.push(await index.get(key));
					} catch(e) {
						console.log(e);
					}
				}
			}
			return new Promise((resolve,reject) => { // db.select({name: {$o1: "name"}}).from({$o1: Object,$o2: Object}).where({$o1: {name: {$o2: "name"}}})
				nodes.every((node,i) => {
					let key = keys[i],
						value = pattern[key],
						type = typeof(value);
					if(!node) {
						if(type==="undefined") {
							return true;
						}
						results[classVar] = [];
						return false;
					}
					if(type!=="object") {
						return literals[i] = true;
					}
					Object.keys(value).forEach((key) => {
						if(classVars[key]) {
							let rightClass = (nestedClass ? nestedClass : classVars[key]),
								rightKeyProperty = rightClass.index.store.keyProperty,
								rightProperty = value[key];
							joins[i] = {rightVar:key, rightClass:rightClass, rightKeyProperty:rightKeyProperty, rightProperty:rightProperty, test:Index.$eeq};
							return;
						}
						if(key[0]==="$") {
							let testvalue = value[key],
								test = Index[key];
							if(typeof(test)==="function") {
								if(testvalue && typeof(testvalue)==="object") {
									let second = Object.keys(testvalue)[0];
									if(classVars[second]) {
										let rightClass= (nestedClass ? nestedClass : classVars[second]),
											rightKeyProperty = rightClass.index.store.keyProperty,
											rightProperty = testvalue[second];
										return joins[i] = {rightVar:second, rightClass:rightClass, rightKeyProperty:rightKeyProperty, rightProperty:rightProperty, test:test};
									}
								}
								tests[i] = true;
								return;
							}
						}
						nestedobjects[i] = true;
						return;
					});
					return true;
				});
				if(results[classVar] && results[classVar].length===0) { resolve([]); return; }
				let exclude = [];
				nodes.every((node,i) => {
					if(!literals[i]) { return true; }
					let key = keys[i],
						value = pattern[key],
						type = typeof(value);
					if(type==="undefined") {
						Object.keys(node).forEach((testValue) => {
							Object.keys(node[testValue]).forEach((testType) => {
								exclude = exclude.concat(Object.keys(node[testValue][testType]));
							});
						});
						return true;
					}
					if(!node[value] || !node[value][type]) { 
						results[classVar] = []; 
						return false;
					}
					let ids = Object.keys(node[value][type]).filter((id) => { 
						return !currentclass || id.indexOf(currentclass.name+"@")===0; 
					});
					results[classVar] = (results[classVar] ? intersection(results[classVar],ids) : ids);
					return results[classVar].length > 0;
				});
				if(results[classVar] && results[classVar].length===0) { resolve([]); return; }
				nodes.every((node,i) => {
					if(!tests[i]) { return true; }
					let key = keys[i],
						predicate = pattern[key],
						testname = Object.keys(predicate)[0],
						value = predicate[testname],
						type = typeof(value),
						test = Index[testname],
						ids = [];
					if(type==="undefined" && (testname==="$eq" || testname==="$eeq")) {
						Object.keys(node).forEach((testValue) => {
							Object.keys(node[testValue]).forEach((testType) => {
								exclude = exclude.concat(Object.keys(node[testValue][testType]));
							});
						});
						return true;
					}
					Object.keys(node).forEach((testValue) => {
						Object.keys(node[testValue]).forEach((testType) => {
							if(test(Index.coerce(testValue,testType),value)) {
								ids = ids.concat(Object.keys(node[testValue][testType]));
							}
						});
					});
					ids = ids.filter((id) => { return !currentclass || id.indexOf(currentclass.name+"@")===0; });
					results[classVar] = (results[classVar] ? intersection(results[classVar],ids) :  intersection(ids,ids));
					return results[classVar].length > 0;
				});
				if(results[classVar] && results[classVar].length===0) { resolve([]); return; }
				promises = [];
				let childnodes = [],
					nestedtypes = [];
				nodes.forEach((node,i) => {
					if(!nestedobjects[i]) { return; }
					let key = keys[i],
						nestedobject = pattern[key];
					Object.keys(node).forEach((key) => {
						if(key.indexOf("@")>0) {
							let parts = key.split("@"),
								clsname = parts[0];
							if(!nestedtypes[clsname]) {
								nestedtypes[clsname] = [];
							}
							childnodes.push(node);
							nestedtypes.push(new Function("return " + clsname)());
						}
					});
					nestedtypes.forEach((nestedtype) => {
						promises.push(nestedtype.index.match(nestedobject,classVars,classMatches,restrictRight,classVar + "$" + nestedtype.name,key,nestedtype));
					});
				});
				Promise.all(promises).then((childidsets) => {
					childidsets.every((childids,i) => {
						let ids = [],
							node = childnodes[i],
							nestedtype = nestedtypes[i];
						childids.forEach((id) => {
							//if(clsprefix && id.indexOf(clsprefix)!==0) { return; } // tests for $class
							if(node[id]) {
								ids = ids.concat(Object.keys(node[id][nestedtype.name]));
							}
						});
						ids = ids.filter((id) => { return !currentclass ||  id.indexOf(currentclass.name+"@")===0; });
						results[classVar] = (results[classVar] ? intersection(results[classVar],ids) : intersection(ids,ids));
						return results[classVar].length > 0;
					});
					if(results[classVar] && results[classVar].length===0) { resolve([]); return;}
					let promises = [];
					
					nodes.forEach((node,i) => { // db.select({name: {$o1: "name"}}).from({$o1: Object,$o2: Object}).where({$o1: {name: {$o2: "name"}}})
						let join = joins[i];
						if(!join) { return true; }
						promises.push(join.rightClass.index.get(join.rightProperty))
						promises.push(join.rightClass.index.get(join.rightProperty));
					});
					Promise.all(promises).then((rightnodes) => { // variable not used, promises just ensure nodes loaded for matching
						if(!results[classVar]) {
							results[classVar] = Object.keys(index.keys[keyProperty]).filter((id) => { return !currentclass || id.indexOf(currentclass.name+"@")===0; });;
						}
						nodes.every((node,i) => { // db.select({name: {$o1: "name"}}).from({$o1: Object,$o2: Object}).where({$o1: {name: {$o2: "name"}}})
							let join = joins[i]; // {rightVar: second, rightIndex:classVars[second].index, rightProperty:testvalue[second], test:test};
							if(!join) { return true; }
							if(cols[join.rightVar]===0) {
								return true;
							}
							let rightIndex = join.rightClass.index,
								rightKeyProperty = join.rightClass.name + "." + join.rightKeyProperty,
								rightProperty = join.rightClass.name + "." + join.rightProperty;
							if(!rightIndex.keys[rightProperty]) {
								results[classVar] = [];
								return false;
							}
							if(!results[join.rightVar]) {
								results[join.rightVar] = Object.keys(rightIndex.keys[rightKeyProperty]).filter((id) => { 
									return !currentclass || id.indexOf(rightIndex.name+"@")===0; 
								});
							}
							let leftids = [];
							Object.keys(node).forEach((leftValue) => {
								Object.keys(node[leftValue]).forEach((leftType) => {
									let innerleftids = Object.keys(node[leftValue][leftType]),
										innerrightids = [],
										some = false,
										pnode = rightIndex.keys[rightProperty];
									Object.keys(pnode).forEach((rightValue) => {
										let vnode = pnode[rightValue];
										Object.keys(vnode).forEach((rightType) => {
											if(join.test(Index.coerce(leftValue,leftType),Index.coerce(rightValue,rightType))) { 
												some = true;
												innerrightids = innerrightids.concat(Object.keys(vnode[rightType]));
											}
										});
									});
									if(some) {
										leftids = leftids.concat(innerleftids); // do we need to filter for class?
										innerrightids = intersection(innerrightids,innerrightids);// do we need to filter for class?
										innerleftids.forEach((id,i) => {
											restrictRight[cols[join.rightVar]][id] = (restrictRight[cols[join.rightVar]][id] ? intersection(restrictRight[cols[join.rightVar]][id],innerrightids) : innerrightids);  
										});
									}
								});
							});
							results[classVar] = (results[classVar] && leftids.length>0 ? intersection(results[classVar],leftids) : leftids);
							return results[classVar] && results[classVar].length > 0;
						});
						if(results[classVar] && results[classVar].length>0) { resolve(results[classVar].filter((item) => { return exclude.indexOf(item)===-1; })); return; }
						resolve([]);
					});
				});
			});
		}
		async put(object) {
			let index = this,
				store = index.store,
				db = store.db,
				keyProperty = store.keyProperty,
				id = object[keyProperty];
			if(!id) {
				id = object.constructor.name +  "@" + (_uuid ? _uuid.v4() : uuid.v4());
				Object.defineProperty(object,keyProperty,{enumerable:true,configurable:true,value:id});
			}
			store.addScope(object);
			return index.index(object,true,db.activate);
		}
		async save(key,f) {
			let index = this,
				indexkey = (this.isInstanceKey(key) ? key : index.name + "." + key),
				node = this.keys[indexkey];
			if(node) {
				return index.store.set(indexkey,node).then(() => {
					if(f) {
						f();
					}
				}).catch((e) => {
					console.log(e);
				});
			}
			return Promise.resolve()
		}
	}
	Index.$ = (value,f) => {
		return f(value);
	}
	Index.$typeof = function() {
		return true; // test is done in method find
	}
	Index.$lt = function(value,testValue) {
		return value < testValue;
	}
	Index["<"] = Index.$lt;
	Index.$lte = function(value,testValue) {
		return value <= testValue;
	}
	Index["<="] = Index.$lte;
	Index.$eq = function(value,testValue) {
		return value == testValue;
	}
	Index["=="] = Index.$eq;
	Index.$neq = function(value,testValue) {
		return value != testValue;
	}
	Index["!="] = Index.$neq;
	Index.$eeq = function(value,testValue) {
		return value === testValue;
	}
	Index["==="] = Index.$eeq;
	Index.$echoes = function(value,testValue) {
		return value==testValue || soundex(value)===soundex(testValue);
	}
	Index.$matches = function(value,testValue) {
		return value.search(testValue)>=0;
	}
	Index.$in = function(value,testValue) {
		if(testValue.indexOf) {
			return testValue.indexOf(value)>=0;
		}
		if(testValue.includes) {
			return testValue.includes(value);
		}
		return false;
	}
	Index.$nin = function(value,testValue) {
		return !Index.$in(value,testValue);
	}
	Index.$between = function(value,testValue) {
		var end1 = testValue[0],
			end2 = testValue[1],
			inclusive = testValue[2],
			start = Math.min(end1,end2),
			stop = Math.max(end1,end2);
		if(inclusive) {
			return value>=start && value<=stop;
		}
		return value>start && value<stop;
	}
	Index.$outside = function(value,testValue) {
		return !Index.$between(value,testValue.concat(true));
	}
	Index.$gte = function(value,testValue) {
		return value >= testValue;
	}
	Index[">="] = Index.$gte;
	Index.$gt = function(value,testValue) {
		return value > testValue;
	}
	Index[">"] = Index.$gt;
		
	class Store {
		constructor(name="Object",keyProperty="@key",db) {
			this.name = name;
			this.keyProperty = keyProperty;
			this.db = db;
			this.scope = {};
			this.ready = async function(clear) {
				if(this.ready.promised) {
					return this.ready.promised;
				}
				this.ready.promised = (clear && this.clear ? this.clear() : Promise.resolve());
				return this.ready.promised;
			}
			this.pending = {};
		}
		addScope(value) {
			let me = this;
			if(value && typeof(value)==="object") {
				me.scope[value.constructor.name] = value.constructor;
				Object.keys(value).forEach((property) => {
					me.addScope(value[property]);
				});
			}
		}
		delete(key,action) {
			let me = this,
				promise = me.pending[key];
			if(!promise) {
				promise = me.pending[key] = new Promise((resolve,reject) => {
					me.pending[key] = me.ready().then(() => action());
					me.pending[key].then(() => {
						delete me.pending[key];
						resolve();
					});
				});
				return promise;
			}
			return new Promise((resolve,reject) => {
				promise.then(() => {
					me.pending[key] = me.ready().then(() => action());
					me.pending[key].then(() => {
						delete me.pending[key];
						resolve();
					});
				});
			});
		}
		get(key,action) {
			let me = this,
				promise = me.pending[key];
			if(!promise) {
				promise = me.pending[key] = new Promise((resolve,reject) => {
					me.pending[key] = me.ready().then(() => action());
					me.pending[key].then((result) => {
						if(result) {
							me.restore(result).then((result) => resolve(result));
						} else {
							resolve(result);
						}
						delete me.pending[key];
					});
				});
				return promise;
			} 
			return new Promise((resolve,reject) => {
				promise.then(() => {
					me.pending[key] = me.ready().then(() => action());
					me.pending[key].then((result) => {
						if(result) {
							me.restore(result).then((result) => resolve(result));
						} else {
							resolve(result);
						}
						delete me.pending[key];
					});
				});
			});
		}
		normalize(value,recursing) {
			let me = this,
				type = typeof(value),
				keyProperty = me.keyProperty,
				result;
			if(value && type==="object") {
				let id = value[keyProperty]
				if(!id) {
					id = value.constructor.name +  "@" + (_uuid ? _uuid.v4() : uuid.v4());
					Object.defineProperty(value,keyProperty,{enumerable:true,configurable:true,value:id});
				}
				let json = (value.toJSON ? value.toJSON() : value);
				if(typeof(json)!=="object") {
					json = value;
				}
				me.addScope(value);
				result = {};
				if(recursing) {
					result[keyProperty] = id;
				} else {
					let keys = Object.keys(json);
					if(json instanceof Date) {
						result.time = json.getTime();
					}
					keys.forEach((key,i) => {
						if(typeof(json[key])!=="function") {
							result[key] = me.normalize(json[key],true);
						}
					});
				}
			} else {
				result = value;
			}
			return result;
		}
		// add cache support to prevent loops
		async restore(json,recurse,cache={}) { 
			let me = this,
				type = typeof(json);
			if(json && type==="object") {
				let key = json[me.keyProperty],
					keys = Object.keys(json),
					keymap = {};
				if(typeof(key)==="string") {
					let parts = key.split("@"),
						cls = me.scope[parts[0]];
					if(!cls) {
						try {
							me.scope[parts[0]] = cls = Function("return " + parts[0])();
						} catch(e) {
							let promises = [];
							keys.forEach((property,i) => {
								keymap[i] = property;
								promises.push(me.restore(json[property],true,cache));
							});
							return new Promise((resolve,reject) => {
								Promise.all(promises).then((results) => {
									results.forEach((data,i) => {
										json[keymap[i]] = data;
									});
									resolve(json);
								});
							});
							
						}
					}
					if(keys.length===1) {
						let object;
						try {
							object = await cls.index.get(key);
						} catch(e) {
							console.log(e);
						}
						
						if(object instanceof cls) {
							return Promise.resolve(object);
						}
						if(cls.fromJSON && object) {
							let instance = cls.fromJSON(object);
							instance[cls.index.store.keyProperty] = key;
							return Promise.resolve(instance);
						}
						let instance = Object.create(cls.prototype);
						if(typeof(object)==="undefined") {
							instance[cls.index.store.keyProperty] = key;
							return Promise.resolve(instance);
						}
						let promises = [];
						if(object && typeof(object)==="object") {
							Object.keys(object).forEach((property,i) => {
								keymap[i] = property;
								promises.push(me.restore(object[property],true,cache));
							});
						}
						return new Promise((resolve,reject) => {
							Promise.all(promises).then((results) => {
								results.forEach((data,i) => {
									instance[keymap[i]] = data;
								});
								resolve(instance);
							});
						});
					} else if(json instanceof cls) {
							let promises = [];
							keys.forEach((property,i) => {
								keymap[i] = property;
								promises.push(me.restore(json[property],true,cache).catch((e) => { console.log(e); }));
							});
							return new Promise((resolve,reject) => {
								Promise.all(promises).then((results) => {
									results.forEach((data,i) => {
										json[keymap[i]] = data;
									});
									resolve(json);
								});
							});
					} else if(cls.fromJSON) {
							let instance = cls.fromJSON(json);
							return Promise.resolve(instance);
					} else {
						let instance = Object.create(cls.prototype),
							promises = [];
						keys.forEach((property,i) => {
							keymap[i] = property;
							promises.push(me.restore(json[property],true,cache));
						});
						return new Promise((resolve,reject) => {
							Promise.all(promises).then((results) => {
								results.forEach((data,i) => {
									instance[keymap[i]] = data;
								});
								resolve(instance);
							});
						});
					}
				}
			}
			return Promise.resolve(json);
		}
		set(key,value,normalize,action) {
			let me = this,
				promise = me.pending[key];
			if(!promise) {
				promise = me.pending[key] = new Promise((resolve,reject) => {
					me.pending[key] = me.ready().then(() => action(normalize ? me.normalize(value) : value));
					me.pending[key].then((result) => {
						delete me.pending[key];
						resolve();
					});
				});
				return promise;
			} 
			return new Promise((resolve,reject) => {
				promise.then(() => {
					me.pending[key] = me.ready().then(() => action(normalize ? me.normalize(value) : value));
					me.pending[key].then((result) => {
						delete me.pending[key];
						resolve();
					});
				});
			});
		}
	}
	class MemStore extends Store {
		constructor(name,keyProperty,db) {
			super(name,keyProperty,db);
			this.data = {};
		}
		async clear() {
			let me = this;
			Object.keys(me.data).forEach((key) => {
				delete me.data[key];
			});
			return true;
		}
		async delete(key) {
			if(this.data[key]) {
				delete this.data[key];
				return true;
			}
			return false;
		}
		async get(key) {
			return this.data[key];
		}
		async set(key,value) {
			this.data[key] = value;
			return true;
		}
	}
	class IronCacheStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			this.ready(clear);
		}
		async clear() {
			let me = this;
			return new Promise((resolve,reject) => {
				me.db.ironCacheClient.clearCache(me.name, function(err, res) {
					if (err) {
						resolve(false);
					} else {
						resolve(true);
					}
				});
			});
		}
		async delete(key) {
			let me = this;
			return super.delete(key, () => new Promise((resolve,reject) => {
				me.db.ironCacheClient.del(me.name, key, function(err, res) {
					if (err) {
						reject(err);
					} else {
						resolve(true);
					}
				});
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key,() => new Promise((resolve,reject) => {
				me.db.ironCacheClient.get(me.name, key, function(err, res) {
					if (err) {
						resolve();
					} else {
						resolve(JSON.parse(res.value));
					}
				});
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				me.db.ironCacheClient.put(me.name, key, { value: JSON.stringify(normalized) }, function(err, res) {
					if (err) {
						reject(err);
					} else {
						resolve(true);
					}
				});
			}));
		}
	}
	class RedisStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			this.storage = this.db.redisClient;
			this.storage.delete = this.storage.del;
			this.ready(clear);
		}
		async clear() {
			let me = this;
			return new Promise((resolve,reject) => {
				let key = me.name + "." + me.keyProperty;
				me.storage.hkeys(me.name, (err, values) => {
					if (err) {
						resolve();
					} else {
						if(values.length===0) {
							resolve();
						} else {
							let multi = me.storage.multi();
							values.forEach((id) => {
								multi = multi.hdel(me.name, id, function(err, res) {
									if (err) {
										reject(err);
									} else {
										resolve(true);
									}
								})
							});
							multi.exec((err,replies) => {
								if(err) {
									console.log(err);
									reject(err);
								} else {
									resolve(true);
								}
							});
						}
					}
				});
			});
		}
		async delete(key) {
			let me = this;
			return super.delete(key,() => new Promise((resolve,reject) => {
				me.storage.hdel(me.name, key, (err, res) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key,() => new Promise((resolve,reject) => {
				me.storage.hget(me.name, key, (err, value) => {
					if (err) {
						resolve();
					} else {
						if(!value) {
							resolve();
						} else {
							resolve(JSON.parse(value));
						}
					}
				});
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				me.storage.hset(me.name,key, JSON.stringify(normalized), (err, res) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}));
		}
	}
	class MemcachedStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			this.storage = this.db.memcachedClient;
			this.ready(clear);
		}
		async clear() {
			let me = this;
			return new Promise((resolve,reject) => {
				let key = me.name + "." + me.keyProperty;
				me.storage.get(key, (err,value) => {
					if (err) {
						resolve();
					} else {
						if(!value) {
							resolve();
						} else {
							me.storage.delete(key, (err, res) => {
								if (err) {
									reject(err);
								} else {
									resolve(true);
								}
							});
						}
					}
				});
			});
		}
		async delete(key) {
			let me = this;
			return super.delete(key,() => new Promise((resolve,reject) => {
				me.storage.delete(key, (err, res) => {
					if (err) {
						reject(err);
					} else {
						resolve(true);
					}
				});
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key,() => new Promise((resolve,reject) => {
				me.storage.get(key, (err,value,key) => {
					if (err) {
						resolve();
					} else {
						if(!value) {
							resolve();
						} else {
							resolve(JSON.parse(value));
						}
					}
				});
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				me.storage.set(key,JSON.stringify(normalized), (err, res) => {
					if (err) {
						reject(err);
					} else {
						resolve(true);
					}
				});
			}));
		}
	}
	class LevelUPStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			this.storage = db.levelUPClient(db.name + "/" + name); //db.levelUPClient(db.name);
			this.ready(clear);
		}
		async clear() {
			let me = this,
				promises = [],
				resolver,
				rejector,
				promise = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; });
			me.storage.createKeyStream().on("data", (key) => {
				promises.push(me.delete(key,true));
			}).on("end",() => {
				Promise.all(promises).then(() => {
					resolver(true);
				});
			}).on("error", () => {
				rejector(err);
			});
			return promise;
		}
		async delete(key) {
			let me = this;
			return super.delete(key,() => new Promise((resolve,reject) => {
				me.storage.del(key+".json",{},(err) => {
					if(err) {
						if(err.notFound) {
							resolve(true);
						} else {
							reject(err);
						}
					} else {
						resolve(true);
					}
				});
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key, () => new Promise((resolve,reject) => {
				me.storage.get(key+".json",{},(err,value) => {
					if(err) {
						if(err.notFound) {
							resolve();
						} else {
							reject(err);
						}
					} else if(!value) {
						resolve();
					} else {
						resolve(JSON.parse(value));
					}
				});
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				me.storage.put(key+".json",JSON.stringify(normalized),{},(err) => {
					if(err) {
						reject(err);
					} else {
						resolve(true);
					}
				});
			}));
		}
	}
	class LocalStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			if(typeof(window)!=="undefined") {
				this.storage = window.localStorage;
			} else {
				let r = require,
					LocalStorage = r("./LocalStorage.js").LocalStorage;
				this.storage = new LocalStorage(db.name + "/" + name);
			}
			if(clear) {
				this.storage.clear();
			}
		}
		async clear() {
			this.storage.clear();
			return true;
		}
		async delete(key) {
			return super.delete(key,() => new Promise((resolve,reject) => {
				this.storage.removeItem(key+".json");
				resolve(true);
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key,() => new Promise((resolve,reject) => {
				let value = me.storage.getItem(key+".json");
				if(!value) {
					resolve();
				} else {
					resolve(JSON.parse(value));
				}
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				me.storage.setItem(key+".json",JSON.stringify(normalized));
				resolve(true)
			}));
		}
	}
	class LocalForageStore extends Store {
		constructor(name,keyProperty,db,clear) {
			super(name,keyProperty,db);
			if(typeof(window)!=="undefined") {
				//window.localforage.config({name:"ReasonDB"})
				this.storage = window.localforage;
			} else {
				let r = require,
				LocalStorage = r("node-localstorage").LocalStorage;
				this.storage = new LocalStorage("./db/" + name);
			}
			if(clear) {
				this.storage.clear();
			}
		}
		async clear() {
			try {
				await this.storage.clear();
			} catch(e) {
				console.log(e);
			}
			return true;
		}
		async delete(key) {
			let me = this;
			return super.delete(key, () => new Promise((resolve,reject) => {
				me.storage.removeItem(key+".json").then(() => {
					resolve(true);
				});
			}));
		}
		async get(key) {
			let me = this;
			return super.get(key, () => new Promise((resolve,reject) => {
				me.storage.getItem(key+".json").then((result) => {
					if(!result) {
						resolve();
					} else {
						resolve(result);
					}
				})
			}));
		}
		async set(key,value,normalize) {
			let me = this;
			return super.set(key,value,normalize,(normalized) => new Promise((resolve,reject) => {
				 me.storage.setItem(key+".json",normalized).then(() => {
					 resolve(true);
				 })
			}));
		}
	}
	class ReasonDB {
		constructor(name,keyProperty="@key",storageType,clear=false,activate=true,options={}) { // make the additional args part of a config object, add a config option for active or passive objects
			let db = this;
			if(typeof(storageType)==="undefined") {
				console.log("WARNING: storageType undefined, defaulting to ReasonDB.MemStore.");
				storageType=MemStore;
			}
			db.name = name;
			db.keyProperty = keyProperty;
			db.storageType = storageType;
			db.clear = clear;
			db.classes = {};
			db.activate = activate;
			Object.keys(options).forEach((key) => {
				db[key] = options[key];
			});
			
			delete Object.index;
			db.index(Object,keyProperty,storageType,clear);
			
			db.Pattern = class Pattern {
				constructor(projection,classVars,when,then) {
					let me = this;
					me.projection = projection;
					me.classNames = {};
					Object.defineProperty(me,"classVars",{configurable:true,writable:true,value:classVars});
					Object.keys(classVars).forEach((classVar) => {
						me.classNames[classVar] = me.classVars[classVar].name;
					});
					Object.defineProperty(me,"when",{configurable:true,writable:true,value:when});
					Object.defineProperty(me,"then",{configurable:true,writable:true,value:then});
					Pattern.index.put(me);
				}
				toJSON() {
					let me = this,
						result = {};
					result[db.keyProperty] = me[db.keyProperty];
					result.classVars = me.classNames;
					result.when = me.when;
					return result;
				}
			}
			db.index(Array,keyProperty,storageType,clear);
			db.index(Date,keyProperty,storageType,clear);
			db.index(db.Pattern,keyProperty,storageType,clear);
			db.patterns = {};
		}
		async deleteIndex(cls) {
			if(cls.index) {
				try {
					await cls.index.clear();
				} catch(e) {
					console.log(e);
				}
				delete cls.index;;
			}
		}
		index(cls,keyProperty,storageType,clear) {
			let db = this;
			keyProperty = (keyProperty ? keyProperty : db.keyProperty);
			storageType = (storageType ? storageType : db.storageType);
			clear = (clear ? clear : db.clear);
			if(!cls.index || clear) { 
				cls.index = new Index(cls,keyProperty,db,storageType,clear);
				db.classes[cls.name] = cls;
			}
			return cls.index;
		}
		delete() {
			let db = this;
			return {
				from(classVars) {
					return {
						where(pattern) {
							return {
								exec() {
									return new Promise((resolve,reject) => {
										db.select().from(classVars).where(pattern).exec().then((cursor) => {
											cursor.count().then((count) => {
												if(count>0) {
													let promises = [];
													Object.keys(cursor.classVarMap).forEach((classVar) => {
														let i = cursor.classVarMap[classVar],
															cls = classVars[classVar];
														cursor.cxproduct.collections[i].forEach((id) => {
															promises.push(cls.index.delete(id).catch((e) => { console.log(e); }));
														});
													});
													Promise.all(promises).then((results) => {
														resolve(results);
													}).catch((e) => { console.log(e); });
													return;
												}
												resolve([]);
											}); 
										});
									});
								}
							}
						}
					}
				}
			}
		}
		insert() {
			var db = this,
				objects = [].slice.call(arguments,0);
			return {
				into(cls) {
					let classes;
					if(arguments.length===1) {
						classes = new Array(...objects);
						classes.forEach((object,i) => {
							classes[i] = cls;
						});
					} else {
						classes = [].slice.call(...arguments,0);
					}
					return {
						exec() {
							let resolver,
								rejector,
								promise = new Promise((resolve,reject) => { resolver = resolve; rejector = reject; }),
								activity = new Activity(resolver);
							objects.forEach((object,i) => {
								activity.step(() => {
										let instance;
										if(object instanceof cls) {
											instance = object;
										} else if(cls.fromJSON) {
											instance = cls.fromJSON(object);
										} else {
											instance = Object.create(cls.prototype);
											Object.defineProperty(instance,"constructor",{configurable:true,writable:true,value:cls});
											Object.keys(object).forEach((key) => {
												instance[key] = object[key];
											});
										}
										if(!cls.index) {
											cls.index = db.index(cls);
										}
										return cls.index.put(instance);
									});
							});
							activity.step(() => {
								activity.results.forEach((instance) => {
									stream(instance,db);
								});
								resolver(activity.results);
							}).exec();
							return promise;
						}
					}
				},
				exec() {
					let classes = [];
					objects.forEach((object) => {
						classes.push(object.constructor);
					})
					return this.into(...classes).exec();
				}
			}
		}
		select(projection) {
			var db = this;
			return {
				first(count) {
					let me = this;
					me.firstCount = count;
					return {
						from(classVars) {
							return me.from(classVars);
						}
					}
				},
				random(count) {
					let me = this;
					me.randomCount = count;
					return {
						from(classVars) {
							return me.from(classVars);
						}
					}
				},
				sample(confidence,range) {
					let me = this;
					me.sampleSpec = {confidence:confidence, range:range};
					return {
						from(classVars) {
							return me.from(classVars);
						}
					}
				},
				from(classVars) {
					let select = this;
					return {
						where(pattern,restrictVar,instanceId) {
							return {
								orderBy(ordering) { // {$o: {name: "asc"}}
									let me = this;
									me.ordering = ordering;
									return {
										exec() {
											return me.exec();
										}
									}
								},
								exec(ordering) {
									return new Promise((resolve,reject) => {
										let matches = {},
											restrictright = {},
											matchvars = [],
											activity = new Activity();
										Object.keys(pattern).forEach((classVar) => {
											if(!classVars[classVar]) { 
												return;
											}
											if(!classVars[classVar].index) {
												db.index(classVars[classVar]);
											}
											matchvars.push(classVar);
											activity.step(() => classVars[classVar].index.match(pattern[classVar],classVars,matches,restrictright,classVar));
										});
										activity.step(() => {
											let pass = true;
											activity.results.every((result,i) => {
												if(result.length===0) {
													pass = false;
												}
												return pass;
											});
											if(!pass) {
												resolve(new Cursor([],new CXProduct([]),projection,{}),matches);
											} else {
												let classes = [],
													collections = [],
													promises = [],
													vars = [],
													classVarMap = {};
												Object.keys(classVars).forEach((classVar) => {
													if(matches[classVar]) {
														collections.push(matches[classVar]);
														classes.push(classVars[classVar]);
													}
												});
												function filter(row,index,cxp) {
													return row.every((item,i) => {
														if(!item) {
															return false;
														}
														if(i===0 || !restrictright[i]) {
															return true;
														}
														let prev = row[i-1];
														return !restrictright[i][prev] || restrictright[i][prev].indexOf(item)>=0;
													});
												}
												let cursor = new Cursor(classes,new CXProduct(collections,filter),projection,classVars);
												if(select.firstCount) {
													cursor.first(select.firstCount).then((rows) => {
														resolve(new Cursor(classes,rows));
													});
												} else if(select.randomCount) {
													cursor.random(select.randomCount).then((rows) => {
														resolve(new Cursor(classes,rows));
													});
												} else if(select.sampleSpec) {
													cursor.sample(select.sampleSpec.confidence,select.sampleSpec.range).then((rows) => {
														resolve(new Cursor(classes,rows));
													});
												} else {
													resolve(cursor,matches);
												}
												return null;
											}
										}).exec();
									});
								}
							}
						}
					}
				}
			}
		}
		update(classVars) {
			var db = this;
			return {
				set(values) {
					return {
						where(pattern) {
							return {
								exec() {
									return new Promise((resolve,reject) => {
										let updated = {},
											promises = [];
										db.select().from(classVars).where(pattern).exec().then((cursor,matches) => {
											let vars = Object.keys(classVars);
											promises.push(cursor.forEach((row) => {
												row.forEach((object,i) => {
													let classVar = vars[i],
														activated;
													if(values[classVar])  {
														Object.keys(values[classVar]).forEach((property) => {
															let value = values[classVar][property];
															if(value && typeof(value)==="object") {
																let sourcevar = Object.keys(value)[0];
																if(classVars[sourcevar]) {
																	let j = vars.indexOf(sourcevar);
																	value = row[j][value[sourcevar]];
																}
															}
															activated = (activated===false || typeof(object[property])==="undefined" ? false : db.activate);
															if(object[property]!==value) {
																object[property] = value;
																updated[object[db.keyProperty]] = true;
															}
														});
														if(!activated) {
															promises.push(db.save(object).exec());
														}
													}
												});
											}));
										});
										Promise.all(promises).then(() => {
											resolve(Object.keys(updated).length);
										});
									});
								}
							}
						}
					}
				}
			}
		}
		when(whenPattern) {
			var db = this;
			return {
				from(classVars) {
					return {
						select(projection) {
							let pattern = new db.Pattern(projection,classVars,whenPattern);
							//	promise = new Promise((resolve,reject) => { pattern.resolver = resolve; pattern.rejector = reject; });
							Object.keys(whenPattern).forEach((classVar) => {
								if(classVar[0]!=="$") { return; }
								let cls = classVars[classVar];
								if(!db.patterns[cls.name]) { db.patterns[cls.name] = {}; }
								Object.keys(whenPattern[classVar]).forEach((property) => {
									if(!db.patterns[cls.name][property]) { db.patterns[cls.name][property] = {}; }
									if(!db.patterns[cls.name][property][pattern[db.keyProperty]]) { db.patterns[cls.name][property][pattern[db.keyProperty]] = {}; }
									if(!db.patterns[cls.name][property][pattern[db.keyProperty]][classVar]) { db.patterns[cls.name][property][pattern[db.keyProperty]][classVar] = pattern; }
								});
							});
							return {
								then(f) {
									Object.defineProperty(pattern,"action",{configurable:true,writable:true,value:f});
								}
							}
						}
					}
				}
			}
		}
	}
	ReasonDB.prototype.save = ReasonDB.prototype.insert;
	ReasonDB.LocalStore = LocalStore;
	ReasonDB.MemStore = MemStore;
	ReasonDB.LocalForageStore = LocalForageStore;
	ReasonDB.IronCacheStore = IronCacheStore;
	ReasonDB.RedisStore = RedisStore;
	ReasonDB.MemcachedStore = MemcachedStore;
	ReasonDB.LevelUPStore = LevelUPStore;
	ReasonDB.Activity = Activity;
	if(typeof(module)!=="undefined") {
		module.exports = ReasonDB;
	}
	if(typeof(window)!=="undefined") {
		window.ReasonDB = ReasonDB;
	}
})();