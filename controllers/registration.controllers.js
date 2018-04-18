const db = require('../configs/mysql').database;
const _ = require('lodash');

exports.greeting = (req,res) => {
  res.json({greet:"hello"})
}

exports.getRegisterResult = async (req,res) => {
	console.log("hello");
	const query_string = "select SubjID,SecID from Register where \
	StudentID = ? and CYear = ? and CSemester = ?" 

	const fields = ['StudentID', 'CYear', 'CSemester'];
	let values = [];

	fields.forEach( (field) => {
		values.push(req.body[field]);
	});
	
	results = await query(query_string, values);

	const query_string_2 = "select SName, Credit from Subj \
												where SID = ?";	

	for(let i = 0; i < results.length; i++){
		detail = await query(query_string_2, [results[i].SubjID]);		
		results[i] = {...results[i], ...detail[0]};
	}	

	let ret = {};
	ret.StudentID = req.body.StudentID;
	ret.CYear = req.body.CYear;
 	ret.CSemester = req.body.CSemester;	
	ret.Subjects = results;	
	res.json(ret);
}

exports.processRequest = (req,res) => {
	new Promise( (resolve,reject) => {

		let query_string = "select * from Section where \
		CYear = ? and CSemester = ?" 

		let fields = ['CYear', 'CSemester'];
		let values = [];

		fields.forEach( (field) => {
			values.push(req.body[field]);
		});

		db.query(query_string, values, (err,sections) => {
			if(err) reject(err);
			else resolve(sections);
		});

	}).catch( (err) => {
		return Promise.reject(err);
	}).then( (sections) => {
		
		let promises = [];
		let query_string = "select Distinct studentID from Request where \
												SubjID = ? and CYear = ? and CSemester = ? and SecID = ?";
		let fields = ['SubjID', 'CYear', 'CSemester', 'SecID'];

		sections.forEach( (section) => {

			let values = [];

			fields.forEach( (field) => {
				values.push(section[field]);
			});

			let promise = new Promise( (resolve,reject) => {
				db.query(query_string, values, (err,studentIDs) => {
					if(err){}
					else{
						resolve({section,studentIDs});
					}
				});
			});

			promises.push(promise);

		});
		
		return Promise.all(promises);

	}).catch( (err) => {
		return Promise.reject(err);
	}).then( (data_list) => {
		let query_string = "insert into Register set ?";

		return Promise.all(data_list.map( (data) => {

			let num_stu = parseInt(_.get(data, ['studentIDs','length'], 0));
			let num_seat = parseInt(_.get(data, ['section','Seat'], 0));
			let selectedStudents = [];

			for(let i=0; i < Math.min(num_seat,num_stu); i++){
				let lucky_man = num_stu+1;
				while(_.get(data, ['studentIDs',lucky_man], null) == null){
					lucky_man = parseInt( Math.random()*num_stu );
				}
				selectedStudents.push( _.get(data, ['studentIDs', lucky_man, 'studentID']) );	
				_.set(data, ['studentIDs', lucky_man] , null);
			}

			return Promise.all(selectedStudents.map( (stu_id) => {

				return new Promise( (resolve,reject) => {
					let values = {
						StudentID: stu_id,
						SubjID: data.section.SubjID,
					 	CYear: data.section.CYear,
					 	CSemester: data.section.CSemester, 
						SecID: data.section.SecID, 
						Grade: null, 
						MSeatNo: null,
						FSeatNo: null 
					};
					db.query(query_string,values, (err, results) => {
						if(err){
							resolve({err:err});
						}
						else resolve(results);
					});
				});	

			}));

		}));	

	}).catch( (err) =>{
		console.error(err);
		res.status(500).json({status:0, error:"error"});	
	}).then( (result) => {
		console.log(result);
		res.json({status:1, message:"done"});
	});
}

exports.deleteRegister = (req,res) => {
	const query_string = "delete from Register where CSemester = ? \
												and CYear = ?";
	db.query(query_string, [
		_.get(req, ['body', 'CSemester'], null),
		_.get(req, ['body', 'CYear'], null)
	], (err, results) => {
		if(err){
			console.error(err);
			res.status(500).json({status:0, error:"error"});
		}
		else{
			res.json({status:1, message:"done"});		
		}	
	});		
}

exports.getRequestResult = (req,res) => {
  const query_string = "select * from Request where StudentID = ? \
  order by SubjID DESC, CSemester DESC, SubjID DESC";
  const student_id = req.query.id;
  db.query(query_string,[student_id], (err,results) => {
    if(err)
      console.log(err);
    else{
      res.json({status:1, messaage:"done", data:results});
    }
  });
}

exports.register = (req,res) => {
  const query_string = "insert into Request values ?";
	const fields = ['StudentID', 'SubjID', 'CYear', 'CSemester', 'SecID']
  const values = [];
	let stu_id = _.get(req,['body','StudentID'],null);	
	let year = _.get(req, ['body', 'CYear'] , null);
	let semester = _.get(req, ['body', 'CSemester'], null);

	_.get(req, ['body', 'Subjects']).forEach( ({SubjID, SecID}) => {
		values.push([
			stu_id,
			SubjID,
			year,
			semester,
			SecID	
		]);
	});

  db.query(query_string, [values], (err, results) => {
    if(err)
      console.log(err);
    else{
      res.json({status:1,messaage: results.affectedRows + " subjects saved"});
    }
  });
}

exports.delete = (req,res) => {
  let query_string = "DELETE FROM Request WHERE StudentID = ? and \
											CYear = ? and CSemester  = ?";
  const fields = ['StudentID', 'CYear', 'CSemester'];
  let values= []
  fields.forEach( (field) => {
     values.push(req.body[field]); 
  });

  db.query(query_string, values, (err, results) => {
    if(err)
      console.log(err);
    else{
      console.log(results);
      res.json({status:1,messaage:"done"});
    }
  });
}

exports.getDetail = async (req,res) => {
	const SubjID = req.query.SubjID; 
	const query_string = "select SName, Credit from Subj where SID = ?"
	let result;
	try{	
		result = await query(query_string, [SubjID]	);
		if(result.length === 0)
			res.json({status:2, message:"no subject found"});
		else
			res.json({...result[0], status:1});
	} catch (e) {
		console.error(e);
		res.status(500).json({status:0, error:"error"});	
	}
}

exports.add = async (req,res) => {

	const query_string = "select Seat,RegSeat from Section where SubjID = ? and \
												CYear = ? and CSemester = ? and SecID = ?";
	const fields = ['SubjID', 'CYear', 'CSemester', 'SecID'];	
	let values = [];

	fields.forEach( (field) => {
		values.push( _.get(req, ['body',field], null) );
	});

	let seat = await query(query_string, values);
	let RegSeat = _.get(seat, [0, 'RegSeat'], 100);
	let Seat = _.get(seat, [0, 'Seat'] , 100);


	const query_insert = "insert into Register set ?"
	const val_insert = {
		'StudentID': req.body.StudentID,
		'SubjID': req.body.SubjID, 
		'CYear' : req.body.CYear,
		'CSemester' : req.body.CSemester, 
		'SecID' : req.body.SecID, 
	}

	if( RegSeat < Seat ){
		try{
			let result = await query(query_insert, val_insert);
			res.json({status:1, message:"success"});	
		}catch(e){
			console.log(e);
			res.status(500).json({status:0, error:"error"});
		}
	}
	else{
		res.json({status:1, message:"failed"});
	}
	
}

exports.remove = async (req,res) => {
	const query_string = "delete from Register where StudentID = ? and SubjID = ? and \
												CYear = ? and CSemester = ? and SecID = ?";
	const fields = ['StudentID','SubjID', 'CYear', 'CSemester', 'SecID'];	
	let values = [];
	fields.forEach( field => {
		values.push( _.get(req, ['body', field], null) );
	});
	
	try{
		let result = await query(query_string, values);
		res.json({status:1, message:"success"});	
	}catch(e){
		console.log(e);
		res.status(500).json({status:0, error:"error"});
	}
}

function query(string, val){
	return new Promise( (resolve,reject) => {
	  db.query(string, val, (err, results) => {
			if(err)
				reject(err);
			else{
				resolve(results);
			}
		});	
	});
}


