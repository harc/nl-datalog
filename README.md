Natural Language Datalog
========================

[![Live demo](https://img.shields.io/badge/Live%20demo-%E2%86%92-9D6EB3.svg?style=flat-square)](https://alexwarth.github.io/projects/nl-datalog)

Consider the task of writing a simple application that lets you select a bunch of recipes from a list, then produces a list of the ingredients that you'll want to buy at the local supermarket, grouped by aisle number. A programmer could certainly write such an application, but there is a good chance he would decide that it's not worth the effort. The typical end-user wouldn't even know where to start... with some luck he might find a 3rd-party app, though it may not do exactly what he wants. It seems that existing tools (programming languages, spreadsheets, database systems, etc.) could be doing much a better job of empowering users, especially non-programmers, to put their data to good use.

A self-respecting end-user certainly wouldn't put up with any system that requires him to write or modify SQL-like table definitions every time he comes across a new kind of information that he wants to represent. No, it's essential that the user be able to store new facts in a more-or-less conversational way, with minimal resistance from the underlying system.

What is the most promising approach to empowering end-users to take data-processing matters into their own hands? At this point I don't really know -- the design space of such a system's user interface, querying / processing engine, etc. is huge -- so I plan to do several experiments to find out what works best.

This experiment builds on Datalog, a powerful and well-understood declarative programming language based on first-order logic. I've written my own Datalog implementation from scratch (including support for stratified negation and aggregation) to make it easy for me to experiment with different extensions and tweaks to the syntax and semantics of the language. For example, so far I have:

* Added a new natural-language-like syntax for defining facts and rules, and
* Devised a new, finger-grained way to compute rule dependencies that makes this Datalog more expressive than standard Datalogs. More specifically, it gives the user / programmer some of the power of higher-order rules without sacrificing the simplicity of first-order logic.

This prototype is written in a combination of JavaScript and OMeta/JS, so it can be used in the convenience of a web browser without downloading any additional software.

-- Alex Warth, sometime in Q4 of 2013

Updates, News, Etc.
-------------------

* The natural language syntax that I invented in this experiment is used to represent facts and queries in Bret Victor & co.'s [RealTalk / DynamicLand](https://twitter.com/dynamicland1).
