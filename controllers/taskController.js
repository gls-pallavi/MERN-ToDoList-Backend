import taskModel from "../models/taskModel.js";
import userModel from "../models/userModel.js";
import { createTransport } from 'nodemailer';
import moment from 'moment-timezone';
import dotenv from "dotenv";
import cron from 'node-cron';
dotenv.config();

// Function to send emails
const sendMail = (email, subject, title, description, isReminder = false) => {
    var transporter = createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USERNAME,
            pass: process.env.GMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: 'taskmaster.mern@gmail.com',
        to: email,
        subject: subject,
        html: `<h1>${isReminder ? 'Task Reminder' : 'Task Added Successfully'} </h1><h2>Title: ${title}</h2><h3>Description: ${description}</h3>`
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

// Function to schedule email reminders
const scheduleEmail = (task) => {
    console.log("Scheduling email for task:", task);

    // Schedule the email based on the task's due time
    const job = cron.schedule(
        moment(task.datetime).tz(task.userTimeZone).format('mm HH DD MM ddd'),
        async function () {
            const { email, title, description } = task;
            try {
                if (!task.reminded) {
                    await sendMail(email, "Task Due Reminder", title, description, true);
                    console.log('Email sent successfully');
                    task.reminded = true; // Mark the task as reminded to avoid sending multiple reminders
                    await task.save();
                }
            } catch (error) {
                console.error('Error sending email:', error.message);
            }
            this.stop();
        },
        { scheduled: true }
    );
};

// Function to add a new task
const addTask = async (req, res) => {
    const { title, description, datetime, userTimeZone } = req.body;
    const userId = req.user.id;
    const istDateTime = moment(datetime).tz('Asia/Kolkata').format();
    try {
        const user = await userModel.find({ _id: userId });
        if (!user || user.length === 0) {
            console.error("User not found for ID:", userId);
            return res.status(404).json({ message: "User not found" });
        }
        const newTask = new taskModel({
            title,
            description,
            datetime: istDateTime,
            completed: false,
            userId,
            userTimeZone,
            email: user[0].email,
            reminded: false, // Mark the task as reminded to avoid sending multiple reminders
        });

        const savedTask = await newTask.save();
        sendMail(user[0].email, "Task Added", title, description);
        scheduleEmail(savedTask);
        return res.status(200).json({ message: "Task added successfully" });
    } catch (error) {
        console.error("Error adding task:", error);
        return res.status(500).json({ message: error.message });
    }
};

const removeTask = (req, res) => {
    const { id } = req.params;
    console.log("Removing task with ID:", id);

    taskModel.findByIdAndDelete(id)
        .then(() => {
            console.log("Task deleted successfully");
            res.status(200).json({ message: "Task deleted successfully" });
        })
        .catch((error) => {
            console.error("Error deleting task:", error);
            res.status(501).json({ message: error.message });
        });
};

const updateTask = async (req, res) => {
    const { id } = req.params;
    const { title, description, datetime, completed } = req.body;
    try {
        const updatedTask = await taskModel.findByIdAndUpdate(
            id,
            { title, description, datetime, completed },
            { new: true }
        );
        res.json(updatedTask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getTask = (req, res) => {
    taskModel.find({ userId: req.user.id })
        .then((data) => res.status(200).json(data))
        .catch((error) => res.status(501).json({ message: error.message }))
}

export { addTask, getTask, removeTask, updateTask };
