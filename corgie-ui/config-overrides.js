module.exports = function override(config, env) {
    config.output.filename = 'static/js/[name].bundle.js';
    config.module.rules.push({
        test: /\.worker\.js$/,
        use: { loader: "worker-loader" },
    });
    return config;
};
