import dragula from 'dragula';

/**
 * Class to manage CMS fields with UI Elements
 */
class MbizCmsFields {

    /**
     * Constructor for MbizCmsFields, see config in `src/Resources/views/Admin/app_javascript.html.twig`
     * @param config
     */
    constructor(config) {
        // Configuration of plugin
        this.config = config;
        this.templateRender = this.config.templateRender;
        this.debug = this.config.debug;
        this.targets = document.querySelectorAll(config.querySelector);
        this.container = document.querySelector(config.containerSelector);
        this.uiElements = this.config.uiElements;
        this.translations = this.config.translations;
        if (this.debug) {
            this.log('Plugin configuration :', this.config);
            this.log('Matched element(s) :', this.targets.length);
        }

        // Internal attributes
        this.id = {
            uiElementContainer: 'mbiz-cms-elements-container',
        };
        this.classes = {
            uiElementList: 'mbiz-cms-component-ui-elements',
            dropableContainer: 'mbiz-cms-dropable-container',
            draggableContainer: 'mbiz-cms-draggable-container',
            draggableItem: 'mbiz-cms-draggable-item',
            draggableItemHandler: 'mbiz-cms-draggable-item-handler',
            deleteButton: 'mbiz-cms-delete-button',
            updateButton: 'mbiz-cms-update-button',
            toggleButton: 'mbiz-cms-toggle-button',
        };
        this.events = {
            uiElementsBuilt: new Event('uiElementsBuilt'),
        };
    }

    /**
     * Init each CMS element
     */
    init() {
        if (this.targets.length) {
            let _self = this;
            this.container.addEventListener('uiElementsBuilt', function(e) {
                _self.log('Ui Elements container is built', e);
                _self.initFields();
                _self.toggleUiElementsVisibility();
            });
            this.initUiElements(this.container, this.uiElements);

        }
    }

    /**
     * Init the UI Elements area
     *
     * @param target
     * @param uiElements
     */
    initUiElements(target, uiElements) {
        this.log('Init UI Elements :', uiElements);

        // Init container
        const uiElementsContainer = document.createElement('div');
        uiElementsContainer.id = this.id.uiElementContainer;
        uiElementsContainer.classList.add(this.classes.dropableContainer, this.classes.uiElementList);

        // Loop on UI Elements
        let error = false;
        for (let type in uiElements) {
            let uiElement = uiElements[type]
            this.log('Init UI Element :', uiElement);

            let renderedUiElement = this.renderUiElementMetaData(type, uiElement, this.templateRender);
            if (renderedUiElement === '') {
                error = true;
                continue;
            }

            uiElementsContainer.insertAdjacentHTML('beforeend', renderedUiElement);
        }

        // Append generated HTML to display current UI Elements of target
        if (!error) {
            target.appendChild(uiElementsContainer);
            this.container.dispatchEvent(this.events.uiElementsBuilt);
        }
    }

    /**
     * Init each CMS fields
     */
    initFields() {
        for (let target of this.targets) {
            let content = target.value;
            this.log('Target\'s content :', content);
            let jsonContent;
            try {
                jsonContent = JSON.parse(content);
            } catch(e) {
                this.error('Unable to parse the CMS JSON for this content : ', content);
                continue;
            }
            this.initField(target, jsonContent);
            this.initActions(target, jsonContent);
        }
    }

    /**
     * Init the field depending on it's parsed content
     *
     * @param target
     * @param jsonContent [{type: "UI Element Type", fields: {}}]
     */
    initField(target, jsonContent) {
        this.log('Init field with parsed content :', jsonContent);

        // Hide original input
        target.setAttribute('hidden', 'true');

        // Init container
        const elementsContainer = document.createElement('div');
        elementsContainer.classList.add(this.classes.draggableContainer, this.classes.uiElementList);

        if (this.templateRender === 'sylius') {
            elementsContainer.classList.add('ui', 'segment', this.classes.draggableContainer, this.classes.uiElementList);
        }

        // Loop on UI Elements
        let error = false;
        for (let uiElement of jsonContent) {
            // Retrieve the Ui Element type
            this.log('Init UI Element :', uiElement);
            if (typeof this.uiElements[uiElement.type] === 'undefined') {
                error = true;
                this.error('Cannot find element of type ', uiElement.type);
                continue;
            }

            // Render Ui Element meta data
            let uiElementMetaData = this.uiElements[uiElement.type];
            this.log('Matched Ui Element with meta data :', uiElementMetaData);
            let renderedUiElementMetaData = this.renderUiElementMetaData(uiElement.type, uiElementMetaData, this.templateRender);
            if (renderedUiElementMetaData === '') {
                error = true;
                continue;
            }

            // Add rendered Ui Element meta data in container
            this.log('Rendered Ui Element meta data :', renderedUiElementMetaData);
            elementsContainer.insertAdjacentHTML('beforeend', renderedUiElementMetaData);
        }

        // Add actions buttons before target
        target.insertAdjacentHTML('beforebegin', this.renderActionsButtons(this.templateRender));

        // Append generated HTML to display current UI Elements of target
        if (!error) {
            target.parentNode.appendChild(elementsContainer);
            let reorder = this.initReorder(document.getElementById(this.id.uiElementContainer), elementsContainer);
            this.initReorderEvent(reorder, target, jsonContent);
        }
    }

    /**
     * Toggle visibility of the ui elements
     */
    toggleUiElementsVisibility() {
        const toggleButtons = document.querySelectorAll('.' + this.classes.toggleButton);

        for (let toggleButton of toggleButtons) {
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();

                document.querySelector('#' + this.id.uiElementContainer).classList.toggle('is-expanded');
            });
        }
    }

    /**
     * Init action for each element, current actions are update and delete
     *
     * @param target
     * @param jsonContent
     */
    initActions(target, jsonContent) {
        // Init Delete
        let deleteButtons = target.parentElement.querySelectorAll('.' + this.classes.deleteButton);
        this.log('Init delete button(s), found : ', deleteButtons.length)
        for (let deleteButton of deleteButtons) {
            this.initDeleteButton(deleteButton, jsonContent, target);
        }

        // Init Update
        let updateButtons = document.querySelectorAll('.' + this.classes.updateButton);
        this.log('Init update button(s), found : ', updateButtons.length)
        for (let updateButton of updateButtons) {
            this.initUpdateButton(updateButton, jsonContent, target);
        }
    }

    /**
     * Call remove UI Element on click after confirm
     *
     * @param deleteButton
     */
    initDeleteButton(deleteButton, jsonContent, target) {
        let _self = this;
        deleteButton.onclick = function() {
            if (confirm(_self.translations.confirm_delete)) {
                let elementToRemove = deleteButton.closest('.' + _self.classes.draggableItem);
                let removedIndex = _self.getElementIndex(elementToRemove);
                if (removedIndex !== false) {
                    _self.removeUiElement(removedIndex, jsonContent, target);
                    elementToRemove.remove();
                }
            }
        };
    }

    /**
     * Call controller to load and display form
     *
     * @param updateButton
     */
    initUpdateButton(updateButton, jsonContent, target) {
        let _self = this;
        updateButton.onclick = function() {
            let elementToUpdate = updateButton.closest('.' + _self.classes.draggableItem);
            let updateIndex = _self.getElementIndex(elementToUpdate);
            if (typeof jsonContent[updateIndex] === 'undefined') {
                _self.error('Cannot find UI Element in index', {index: updateIndex, jsonContent: jsonContent});
            }
            let uiElementToUpdate = jsonContent[updateIndex];
            _self.log('UI Element to update', uiElementToUpdate)
        };
    }

    /**
     * Return markup to display UI Element meta data depending on render
     *
     * @param type
     * @param uiElementMetaData {short_description: "Short description", description: "Description", title: "Title", image: "/path/to/image.jpg"}
     * @param templateRender
     */
    renderUiElementMetaData(type, uiElementMetaData, templateRender) {
        if (templateRender === 'sylius') {
            return `
            <div class="ui segment raised ${this.classes.draggableItem}" data-ui-element-type="${type}">
                <button class="ui right floated massive button icon ${this.classes.draggableItemHandler}" type="button"><i class="icon arrows alternate ${this.classes.draggableItemHandler}"></i></button>
                <div class="ui grid">
                    <div class="four wide column">
                        <img class="ui small image" src="${uiElementMetaData.image}" alt="" width="150" height="150">
                    </div>
                    <div class="twelve wide column">
                        <h2 class="ui header">${uiElementMetaData.title}</h2>
                        <p>${uiElementMetaData.description}</p>
                        <div class="ui buttons">
                            <button class="ui button ${this.classes.updateButton}" type="button">${this.translations.edit}</button>
                            <button class="ui button negative ${this.classes.deleteButton}" type="button">${this.translations.delete}</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }

        this.error('Cannot find render for : ', templateRender);
        return '';
    }

    /**
     * Return markup to display action buttons
     */
    renderActionsButtons(templateRender) {
        if (templateRender === 'sylius') {
            return `
            <div class="field">
                <div class="ui buttons">
                    <button class="ui primary button ${this.classes.toggleButton}" type="button">${this.translations.new}</button>
                </div>
            </div>
            `;
        }

        this.error('Cannot find render for : ', templateRender);
        return '';
    }

    /**
     * Init draggable elements for a container
     *
     * @param uiElements
     * @param elementsContainer
     */
    initReorder(uiElements, elementsContainer) {
        let _self = this;
        let drake = new dragula([uiElements, elementsContainer], {
            copy: function (el, source) {
                return source === uiElements
            },
            accepts: function (el, target) {
                return target !== uiElements
            },
            moves: function (el, container, handle) {
                return handle.classList.contains(_self.classes.draggableItemHandler);
            }
        });
        return drake;
    }

    /**
     * Init event to be able to reorder elements in it's field
     *
     * @param drake
     * @param target
     * @param jsonContent
     */
    initReorderEvent(drake, target, jsonContent) {
        drake.on('drag', (el, source) => {
            // Reorder inside the list
            if (source.id !== this.id.uiElementContainer) {
                const index = this.getElementIndex(el);
                if (index !== false) {
                    this.log('Reorder drag start : ', {index: index, el: el, source: source});
                    this.currentIndex = index;
                }
            }

            // Add a new element from top
            if (source.id === this.id.uiElementContainer) {
                this.log('Copy drag start : ', {el: el, source: source});
            }
        });
        drake.on('drop', (el, targetElement, source, sibling) => {
            // Reorder inside the list
            if (source.id !== this.id.uiElementContainer) {
                const oldIndex = this.currentIndex;
                const newIndex = this.getElementIndex(el);
                if (newIndex !== false) {
                    this.log('Reorder drag stop : ', {oldIndex: oldIndex, newIndex: newIndex, el: el, targetElement: targetElement, source: source, sibling: sibling});
                    this.moveUiElement(oldIndex, newIndex, jsonContent, target)
                }
            }

            // Add a new element from top to Ui Element list
            if (source.id === this.id.uiElementContainer && targetElement !== null && targetElement.classList.contains(this.classes.uiElementList)) {
                this.log('Copy drag stop : ', {el: el, targetElement: targetElement, source: source, sibling: sibling});
                const newIndex = this.getElementIndex(el);
                const type = el.dataset.uiElementType;
                if (typeof type !== 'undefined') {
                    this.addUiElement(type, newIndex, jsonContent, target)
                } else {
                    this.error('Cannot find `uiElementType` to add in data set', {dataSet: el.dataset, el: el});
                }
            }
        });
    }

    /**
     * Retrieve the index of element in UI Elements list
     *
     * @param el
     * @returns {boolean|number}
     */
    getElementIndex(el) {
        if (!el.parentElement) {
            return false;
        }
        return [].slice.call(el.parentElement.children).indexOf(el);
    }

    /**
     * Update the JSON to add an UI element
     *
     * @param type
     * @param index
     * @param jsonContent
     * @param target
     */
    addUiElement(type, index, jsonContent, target) {
        this.log('Add UI Element : ', {type: type, index: index, target: target, beforeMoveJson: jsonContent});
        let uiElement = {type: type, fields: []};
        jsonContent.splice(index, 0, uiElement);
        target.value = JSON.stringify(jsonContent);
        this.log('Added UI Element : ', {afterMoveJson: jsonContent, newTargetValue: target.value});
        this.initActions(target, jsonContent);
    }

    /**
     * Update the JSON to move UI elements
     *
     * @param oldIndex
     * @param newIndex
     * @param jsonContent
     * @param target
     */
    moveUiElement(oldIndex, newIndex, jsonContent, target) {
        if (oldIndex !== newIndex) {
            this.log('Move UI Element : ', {oldIndex: oldIndex, newIndex: newIndex, target: target, beforeMoveJson: jsonContent});
            if (newIndex >= jsonContent.length) {
                this.error('Element moved outside the list', {newIndex: newIndex, sizeList: jsonContent.length})
            }
            jsonContent.splice(newIndex, 0, jsonContent.splice(oldIndex, 1)[0]);
            target.value = JSON.stringify(jsonContent);
            this.log('Moved UI Element : ', {afterMoveJson: jsonContent, newTargetValue: target.value});
        } else {
            this.log('Not moved UI Element, same index', {oldIndex: oldIndex, newIndex: newIndex, target: target, beforeMoveJson: jsonContent});
        }
    }

    /**
     * Update the JSON to remove UI element
     *
     * @param removedIndex
     * @param jsonContent
     * @param target
     */
    removeUiElement(removedIndex, jsonContent, target) {
        this.log('Remove UI Element : ', {removedIndex: removedIndex, target: target, beforeMoveJson: jsonContent});
        jsonContent.splice(removedIndex, 1);
        target.value = JSON.stringify(jsonContent);
        this.log('Removed UI Element : ', {afterMoveJson: jsonContent, newTargetValue: target.value});
    }

    /**
     * Add console error if debug
     *
     * @param description
     * @param content
     */
    error(description, content) {
        // If error, display original fields
        for (let target of this.targets) {
            target.removeAttribute('hidden');
        }
        // Remove generated blocks
        for (let target of document.querySelectorAll('.' + this.classes.uiElementList)) {
            target.remove();
        }

        if (this.debug) {
            console.error(description);
            console.error(content);
        }
    }

    /**
     * Add console log if debug is true
     *
     * @param description
     * @param content
     */
    log(description, content) {
        if (this.debug) {
            console.log(description);
            console.log(content);
        }
    }
}

// Init the plugin
document.addEventListener('DOMContentLoaded', () => {
    let cms = new MbizCmsFields(monsieurbizCmsPluginConfig);
    cms.init();
});
