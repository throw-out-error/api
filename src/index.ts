import { App } from "@tinyhttp/app";
import * as yup from "yup";
import { logger } from "@tinyhttp/logger";
import { nanoid } from "nanoid";
import bodyParser from "body-parser";
import monk from "monk";
import dotenv from "dotenv";
import helmet from "helmet";

dotenv.config();

const db = monk(process.env.MONGO_URI);
const urls = db.get("urls");
urls.createIndex("slug");

const urlSchema = yup.object().shape({
    slug: yup
        .string()
        .trim()
        .matches(/[\w\-]/i),
    url: yup.string().trim().url().required(),
});

const app = new App({
    onError: (error, req, res, next) => {
        if (error.status) res.status(error.status);

        res.json({
            message: error.message ?? error.toString(),
            stack: (process.env.NODE_ENV = "production"
                ? "🥞"
                : error.stack ?? {}),
        });
    },
});

app.use(logger())
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(helmet());

app.get("/", (_, res) => void res.send("<h1>Hello World</h1>"));

app.post("/url", async (req, res, next) => {
    let { slug, url } = req.body;
    try {
        await urlSchema.validate({
            slug,
            url,
        });
        if (!slug) slug = nanoid(5);
        else {
            const existing = await urls.findOne({ slug });
            if (existing) throw new Error("Slug in use.");
        }
        slug = slug.toLowerCase();
        const secret = nanoid(10).toLowerCase();
        const newUrl = {
            url,
            slug,
            secret,
        };
        const created = await urls.insert(newUrl);
        res.json(created);
    } catch (err) {
        //if (err.message.startsWith("E11000")) err.message = "Slug in use.";
        next(err);
    }
});

app.get("/:id", async (req, res) => {
    const { id: slug } = req.params;
    try {
        const url = await urls.findOne({ slug });
        if (url) res.redirect(url.url);
        res.redirect(`/?error=${slug} not found`);
    } catch (error) {
        res.redirect("/?error=Link not found");
    }
});

const port = parseInt(process.env.PORT ?? "3000");

app.listen(port, () => console.log(`Listening on ${port}`));
