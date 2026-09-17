(function ($) {
	const LETTER_KEY_CODES = Array.from({ length: 26 }, (v, i) => i + 65);

	function refreshTreeIcon(ele, treeicon) {
		$(ele).addClass(treeicon);
	}

	function bindTreeIconRefreshOnClick(ele, treeicon) {
		$(ele).on('click', function () {
			setTimeout(() => refreshTreeIcon(ele, treeicon), 0);
		});
	}

	function updateTreeIcons(treeicon) {
		const eleClose = $('.app-tree li span.button.switch');
		$(eleClose).map((idx, ele) => {
			refreshTreeIcon(ele, treeicon);
			bindTreeIconRefreshOnClick(ele, treeicon);
		});
	}

	function matchesNodeAccessKey(node, keyCode) {
		return 'accesskey' in node && node.accesskey.length && (node.accesskey.charCodeAt(0) & 95) === keyCode;
	}

	function findNodeMatchingLetterKey(zTree, rootNodes, keyCode) {
		if (!LETTER_KEY_CODES.includes(keyCode & 95)) return null;

		const nodes = zTree.transformToArray(rootNodes).filter(node => matchesNodeAccessKey(node, keyCode));
		if (!nodes.length) return null;

		const selectedNodes = zTree.getSelectedNodes();
		if (!selectedNodes.length) return null;

		if (selectedNodes[0] === nodes[0]) return null;

		return nodes[0];
	}

	/**
	 * Dummy function to provide a placeholder for the destroy function
	 */
	$.fn.zTreeKeyboardNavigationDestroy = function () {
	}

	/**
	 * Creates a function that adds keyboard navigation:
	 * Home: home key (keycode 36)				Goes to the first root element is visible
	 * End: end key (keycode 35)				Goes to the last leaf node and will expand nodes and scroll the element into view
	 * Down: right cursor key (keycode 39)		Goes to the next visible node in the tree following the hierarchy
	 * Next: down cursor key (keycode 40)		Goes to the next visible node at the same level
	 * Up: up cursor key (keycode 37)			Goes to the prior visible node at the same level
	 * Previous: left cursor key (keycode 38)	Goes to the prior visible node following the hierarchy
	 * Toggle: space key (keycode 32)			Toggles the expand/collapse state of a parent node
	 * @param {IxTreeObj} zTree
	 * @param {string|JQuery<HTMLElement} element
	 * @param {IJSON[]} selectedNodes
	 */
	$.fn.zTreeKeyboardNavigation = function (zTree, element, selectedNodes = null, treeicon) {
		if (typeof element === 'string' || element instanceof String) {
			element = $(element);
		}

		const rootNodes = zTree.getNodes();
		if (!rootNodes) return;

		const focusSelectedNode = function () {
			const currentSelectedNodes = zTree.getSelectedNodes();
			if (currentSelectedNodes && currentSelectedNodes.length) {
				$("#" + currentSelectedNodes[0].tId).focus();
			}
		}

		// Clear the previous event handler (there may be none)
		$.fn.zTreeKeyboardNavigationDestroy();

		/**
		 * Make it possible to destroy (remove the event handlers)
		 */
		$.fn.zTreeKeyboardNavigationDestroy = function () {
			$(element).off('keydown');
		}

		$.fn.changeTreeIcons = function () {
			updateTreeIcons(treeicon);
		}

		$(element).on('keydown', function (e) {
			const selectedNodes = zTree.getSelectedNodes();
			const selectedNode = selectedNodes.length ? selectedNodes[0] : null;

			const processSpace = function () {
				// If there are no nodes or the selected node is not a parent, get out
				if (selectedNode && selectedNode.isParent) {
					// Toggle the node
					zTree.expandNode(selectedNode, !selectedNode.open, true, true);
					$.fn.changeTreeIcons()
				}
			}

			const processHome = function () {
				zTree.selectNode(rootNodes[0], false, true);
			}

			const processEnd = function () {
				const nodes = zTree.transformToArray(rootNodes);
				// Select the last node
				zTree.selectNode(nodes[nodes.length - 1]);
			}

			const processUp = function () {
				let priorNode;
				if (selectedNode) {
					priorNode = selectedNode.getPreNode();
					if (!priorNode) return;
				}
				else {
					processEnd();
				}

				if (!priorNode) return;

				zTree.selectNode(priorNode);
			}

			const processDown = function () {
				let nextNode;
				if (selectedNode) {
					nextNode = selectedNode.getNextNode();
					if (!nextNode) return;
				}
				else {
					processHome();
				}

				if (!nextNode) return;

				zTree.selectNode(nextNode);
			}

			const processOut = function () {
				if (!selectedNode) return;

				const parentNode = selectedNode.getParentNode();
				let priorNode = selectedNode.getPreNode();
				if (!parentNode && !priorNode) return; // Must have been the root node

				if (priorNode) {
					if (priorNode.isParent) {
						// There is a prior node, now the the question is where is the last open node?
						while (priorNode) {
							if (!priorNode.isParent || !priorNode.open || !priorNode.children) break;

							priorNode = priorNode.children[priorNode.children.length - 1];
						}

						zTree.selectNode(priorNode);
						return;
					}
					else {
						zTree.selectNode(priorNode);
						return;
					}
				}

				// Find the parent node with a valid prior sibling
				if (parentNode) {
					// This call should be silent otherwise (in my view a bug in)
					// selectNode causes the root node to blur
					zTree.selectNode(parentNode, false, true);
				}
			}

			const processIn = function () {
				if (!selectedNode) return;

				if (selectedNode.isParent && selectedNode.open && selectedNode.children) {
					zTree.selectNode(selectedNode.children[0]);
					return;
				}

				const nextNode = selectedNode.getNextNode();
				if (nextNode) {
					zTree.selectNode(nextNode);
				}
				else {
					// Cannot be root if there is a selected node that is not a parent
					let node = selectedNode;
					// Find the parent node with a valid next sibling
					while (node = node.getParentNode()) {
						const nextNode = node.getNextNode();
						if (nextNode) {
							zTree.selectNode(nextNode);
							break;
						}
					}
				}
			}

			const processLetter = function (keyCode) {
				const node = findNodeMatchingLetterKey(zTree, rootNodes, keyCode);
				if (!node) return false;

				zTree.selectNode(node);
				return true;
			}

			switch (e.keyCode) {
				case 32: /* Toggle parent nodes */
					processSpace();
					return;

				case 36: /* Home - go to the root node */
					processHome();
					break;

				case 35: /* End - go to the last node */
					processEnd();
					break;

				case 33: /* PageUp */
					// Do nothing
					break;

				case 34: /* PageDown */
					// Do nothing
					break;

				case 37: /* Left */
					processOut();
					break;

				case 38: /* Up */
					processUp();
					break;

				case 39: /* Right */
					processIn();
					break;

				case 40: /* Down */
					processDown();
					break;

				default:
					if (!processLetter(e.keyCode & 95)) return;
					break;
			}

			focusSelectedNode();
		});

		if (selectedNodes && selectedNodes.length) {
			zTree.selectNode(selectedNodes[0]);
			focusSelectedNode();
		}
		else {
			$(element).trigger({ type: 'keydown', which: 36, keyCode: 36 });
		}

	}

})(jQuery);
